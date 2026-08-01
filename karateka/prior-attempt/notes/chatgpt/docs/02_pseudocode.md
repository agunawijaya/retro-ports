# Phase 2 - Pseudocode Extraction

This is C-like pseudocode derived from static disassembly. It is not production source and does not copy original assets or binary data. Names are behavior-based labels. Addresses refer to load-image offsets unless marked as file offsets.

## Startup And Main Transfer

Evidence: entry disassembly `0x0002..0x01F5`, call to `0x5953`.

```c
void mz_entry(void) {
    disable_interrupts();
    DS = relocated_segment_0x06CA;
    SS = relocated_segment_0x155C;
    SP = 0x0080;
    enable_interrupts();

    dos_version = dos_get_version();      // int 21h AH=30h at 0x0011
    saved_psp_segment = ES;               // [0x005B]

    parse_environment_and_command_tail(); // 0x002A..0x00F6
    resize_stack_and_heap();              // 0x00F6..0x017E
    detect_fpu();                         // fninit/fnstsw at 0x01D3

    lattice_c_main_candidate(argv_string); // call 0x5953 at 0x01F5

    dos_exit(0);                          // int 21h AX=4C00 at 0x01FF
}
```

## Lattice C Main Candidate

Evidence: `0x5953..0x5B2D`.

```c
int runtime_main_candidate(char *cmdline) {
    argv_count = tokenize_cmdline(cmdline, argv_table, 32);

    if (dos_version < 2) {
        // UNKNOWN: compatibility setup path.
        open_stdio_legacy();
    } else {
        setup_standard_handles();
        ioctl_check_stdin_stdout();       // int 21h AX=4400 wrapper at 0x5D7E
    }

    // HYPOTHESIS:
    // 0x0255 is the actual game entry after Lattice startup.
    game_entry(argv_table, argv_count);

    close_or_flush_runtime();
    return 0;
}
```

## DOS File API Wrappers

Evidence: `0x5C9B..0x5D9E`.

```c
int dos_open(char *path, int mode) {      // 0x5CB5
    last_error = 0;
    AX = int21_ah3d_open(path, mode);
    if (carry) last_error = AX;
    return AX;
}

int dos_read(int handle, void *dst, uint16_t count) { // 0x5CE6
    last_error = 0;
    AX = int21_ah3f_read(handle, dst, count);
    if (carry) {
        last_error = AX;
        return 0;
    }
    return AX;
}

long dos_seek(int handle, long offset, int origin) {  // 0x5D24
    last_error = 0;
    DX_AX = int21_ah42_lseek(handle, offset, origin);
    if (carry) last_error = AX;
    return DX_AX;
}
```

## Resource Loading

Evidence: filename/string tables at load offset `0x6E16`; DOS wrappers at `0x5CC6`, `0x5CFA`, `0x5D3B`; parser at `0x1027..0x121A`.

```c
struct IndexEntry {
    uint16_t id;
    uint16_t offset;
};

void load_indexed_resource_group(int group_id) {
    char ind_name[32];
    char dat_name[32];

    // HYPOTHESIS:
    // base names are selected from tables containing ks0/ks1/... and km0/km1/...
    make_name(ind_name, selected_base_name, ".ind");
    make_name(dat_name, selected_base_name, ".dat");

    IndexEntry *index = read_ind_file(ind_name);
    uint8_t *data = read_dat_file(dat_name);

    for (IndexEntry *e = index; e->id != 0xFFFF; e++) {
        resource_table[e->id] = data + e->offset;
    }
}
```

```c
void parse_animation_or_frame_tables(int resource_set) { // 0x1027
    buffer = load_file_by_table(resource_set, extension_ind);
    copy_to_table_423c(buffer, 0x02A8);

    for (offset = 0; offset < 0x02A8; offset += 4) {
        id = table443c[offset + 0];
        lo = table443c[offset + 2];
        hi = table443c[offset + 3];
        target = current_base + ((hi << 8) + lo);
        table423c[id] = low_byte(target);
        table423d[id] = high_byte(target);

        if (id == 0xFF) {
            end_offset = (hi << 8) + lo;
            break;
        }
    }

    // Repeats similar logic for second table at 0x893A.
}
```

## Video Adapter Initialization

Evidence: `0x4273..0x43A9`, `0x4352..0x438B`.

```c
int init_video_adapter(void) {
    equipment = bios_equipment_flags();   // int 11h at 0x4352
    old_mode = bios_get_video_mode();     // int 10h AH=0F at 0x4357

    if (try_cga_mode4_path()) {
        return 'A' + detected_adapter_index;
    }

    if (try_alternate_cga_register_path()) {
        return 'A' + detected_adapter_index;
    }

    restore_video_mode(old_mode);
    print_adapter_error();
    return 0;
}

bool try_cga_mode4_path(void) {           // 0x4273
    outportb(0x03BF, 0);
    set_bios_equipment_graphics_bits();
    bios_set_video_mode(4);               // int 10h AH=00 AL=04

    fill_video_memory(video_segment, 0x1F40, 0x55AA);
    if (!verify_fill(video_segment, 0x1F40, 0x55AA)) {
        return false;
    }

    build_row_offset_table_mode4();        // 200 rows, step 0x50
    return true;
}
```

## Input Handling

Evidence: `0x4149..0x41FC`.

```c
int poll_input(void) {
    if (!keyboard_or_runtime_ready()) {    // call 0x16A3
        if (pending_key_flag) {
            return 0xFF;
        }
        return 0;
    }

    key = read_key();

    if (key == ESC) {
        read_key_no_echo();               // consumes another key
        return 0;
    }

    if (key == 0x12) {
        redraw_or_pause_feedback();        // call 0x4241
        input_mode_flag = 1;               // [0xDF44]
        return 0;
    }

    if (key == 0x13) {
        redraw_or_pause_feedback();        // call 0x4241
        sound_mode = (sound_mode + 1) % 3; // [0xD6BC]
        return 0;
    }

    if (special_scene_state == 1 && key == 0x16) {
        // HYPOTHESIS: special action/test/debug or scene-specific transition.
        play_or_draw_feedback(0x5D, 0x96, 0xBE);
        scene_transition_call();
        return 0;
    }

    if (key == 0) {
        scan = dos_read_char_no_echo();    // int 21h AH=07
        if (scan == 0x4B) key = '4';       // left arrow
        else if (scan == 0x4D) key = '6';  // right arrow
        else return 0;
    }

    last_key = key;                        // [0xDF42]
    pending_key_flag = 1;                  // [0xDF43]
    return 0xFF;
}
```

## Timing

Evidence: `0x18BF..0x190A`.

```c
void wait_bios_ticks(uint16_t ticks) {
    target = bios_get_tick_dx() + ticks;   // int 1Ah AH=00
    do {
        now = bios_get_tick_dx();
    } while (now != target);
}

void mark_frame_time(void) {
    last_tick = bios_get_tick_dx();        // [0xBCD1]
}

void wait_until_three_ticks_elapsed(void) {
    do {
        now = bios_get_tick_dx();
    } while ((uint16_t)(now - last_tick) < 3);

    last_tick = now;
}
```

## Animation Stream Step

Evidence: `0x0B5E..0x0BC8`.

```c
uint8_t next_stream_a_byte(void) {
    if (stream_a_repeat_count != 0) {
        stream_a_repeat_count--;
        return stream_a_repeat_value;
    }

    uint8_t b = stream_a_base[stream_a_pos++]; // base table near 0x443C

    if (b == 0x7B) {
        stream_a_repeat_count = stream_a_base[stream_a_pos++];
        stream_a_repeat_value = stream_a_base[stream_a_pos++];
        b = stream_a_repeat_value;
    }

    return b;
}

uint8_t next_stream_b_byte(void) {
    if (stream_b_repeat_count != 0) {
        stream_b_repeat_count--;
        return stream_b_repeat_value;
    }

    uint8_t b = stream_b_base[stream_b_pos++]; // base table near 0x893A

    if (b == 0x7B) {
        stream_b_repeat_count = stream_b_base[stream_b_pos++];
        stream_b_repeat_value = stream_b_base[stream_b_pos++];
        b = stream_b_repeat_value;
    }

    return b;
}
```

## Rendering Call Structure

Evidence: `0x0BC9..0x0D39`.

```c
void render_draw_list(void) {
    draw_ptr = 3;
    prepare_background_or_buffer(current_scene_byte);

    while (true) {
        uint8_t sprite_id = draw_list[draw_ptr + 0];
        if (sprite_id == 0xFF) break;

        uint16_t packed_xy_flags = read16(draw_list + draw_ptr + 1);
        uint8_t extra = draw_list[draw_ptr + 3];

        if ((packed_xy_flags & 0x4000) && !(packed_xy_flags & 0x8000)) {
            draw_variant_masked(sprite_id, packed_xy_flags ^ 0x4000, extra); // call 0x0640
        } else {
            draw_variant_normal(sprite_id, packed_xy_flags, extra);          // call 0x083C
        }

        draw_ptr += 4;
    }

    if (wipe_mode == 0) {
        if (render_enabled) {
            present_buffer_fast();        // call 0x0D68
        } else {
            present_buffer_slow();        // call 0x0D89
        }
    } else {
        present_buffer_wipe();            // call 0x0DEF
    }

    play_sound_event(current_sound_id);    // call 0x3BAE
}
```

## Player And Enemy State

```c
struct FighterState {
    int x;
    int y;
    int facing;
    int health_or_stamina;
    int action_state;
    int animation_id;
    int animation_frame;
    int hit_window;
    int hurt_window;
};

// UNKNOWN:
// Exact memory offsets for player/enemy fields are not fully proven.
// Candidate global state words include [0x160], [0x162], [0x164],
// [0x168], [0x172], reset around 0x19D1..0x19E4.
```

## Position And Movement Update

```c
void update_fighter_from_input(FighterState *player, int key) {
    switch (key) {
    case '4':
        player->facing = LEFT;
        request_animation(player, ANIM_WALK_OR_STEP_LEFT);
        player->x -= movement_delta_for_current_frame(player);
        break;
    case '6':
        player->facing = RIGHT;
        request_animation(player, ANIM_WALK_OR_STEP_RIGHT);
        player->x += movement_delta_for_current_frame(player);
        break;
    case 'q':
    case 'a':
    case 'z':
    case 'w':
    case 's':
    case 'x':
        // HYPOTHESIS: high/mid/low punch/kick or stance controls.
        request_attack_or_block_animation(player, key);
        break;
    default:
        request_animation(player, ANIM_IDLE_OR_READY);
        break;
    }
}
```

## Collision Detection And Combat Resolution

```c
bool fighters_overlap(FighterState *a, FighterState *b) {
    // HYPOTHESIS:
    // Static helper near 0x43AA uses table lookups indexed by direction/state
    // and x/y-like values to classify drawing or collision regions.
    Rect ra = hitbox_from_animation_frame(a->animation_id, a->animation_frame, a->facing);
    Rect rb = hurtbox_from_animation_frame(b->animation_id, b->animation_frame, b->facing);
    return rects_overlap(translate(ra, a->x, a->y), translate(rb, b->x, b->y));
}

void resolve_combat(FighterState *attacker, FighterState *defender) {
    if (!attacker->hit_window) return;
    if (!defender->hurt_window) return;
    if (!fighters_overlap(attacker, defender)) return;

    defender->health_or_stamina--;
    defender->action_state = STATE_HURT;
    request_animation(defender, ANIM_HIT_REACTION);

    if (defender->health_or_stamina <= 0) {
        defender->action_state = STATE_DEFEATED;
        request_animation(defender, ANIM_DEATH_OR_FALL);
    }
}
```

## Main Game Loop

```c
void game_loop(void) {
    init_video_adapter();
    load_scene_resources();
    init_sound_tables();
    reset_scene_state();                  // around 0x19AE
    mark_frame_time();

    while (!game_over) {
        int input = poll_input();

        if (input_available(input)) {
            update_fighter_from_input(&player, last_key);
        }

        update_ai(&enemy, &player);
        step_animation_streams();
        update_positions(&player, &enemy);
        resolve_combat(&player, &enemy);
        resolve_combat(&enemy, &player);

        if (player.health_or_stamina <= 0) {
            enter_lose_state();
        } else if (enemy_defeated_and_scene_clear()) {
            advance_scene_or_level();
        } else if (reached_mariko_or_final_condition()) {
            enter_win_state();
        }

        render_draw_list();
        wait_until_three_ticks_elapsed();
    }
}
```

## Level/Scene Transition

```c
void advance_scene_or_level(void) {
    // HYPOTHESIS:
    // Scene scripts select resource groups and command streams by index.
    current_scene++;
    load_indexed_resource_group(scene_to_resource_group[current_scene]);
    reset_animation_streams_for_scene();
    reset_fighter_positions();
}
```

## Death / Win / Lose Conditions

```c
void enter_lose_state(void) {
    // NEEDS DEBUG CONFIRMATION:
    // Identify exact death animation and restart prompt paths.
    request_animation(&player, ANIM_PLAYER_DEFEATED);
    play_sound_event(SOUND_DEATH_OR_HIT);
    wait_for_key_or_restart();
}

void enter_win_state(void) {
    // Evidence: ending text strings at file offsets 0x14C61..0x14D56.
    show_story_text(ENDING_TEXT_TABLE);
    show_credits();
}
```

## Remaining Unknowns

- Exact game entry function after `0x0255`.
- Exact player/enemy structure offsets.
- Exact hitbox/hurtbox tables.
- Exact AI decision routine.
- Whether there are adapter paths beyond CGA-compatible mode 4.
- Whether any hidden keyboard/debug controls exist beyond the statically visible mappings.
