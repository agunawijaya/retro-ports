"""Play Karateka to the end under the toolkit's emulator, with a bot.

Runs the original KARATEKA.EXE in comrun's Machine. A callback at the hero's
decision point (player_choose_move, image 0x206D) reads the game's globals and
hands one key to the BIOS keyboard buffer, the way comrun's --at does. Frames
are written whenever the scene or level changes and at named moments.

    python tools/playthrough.py [--budget N] [--tag NAME] [--film N]
Writes review/playthrough/<tag>/: log.jsonl (one line per decision),
frames/*.png, events.txt.
"""
import argparse, json, struct, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent      # the karateka folder
DS = 0x6CA0                      # DS:x is image offset x + 0x6CA0

G = dict(player_pose=0x010C, guard_pose=0x0110, guard_x=0x010E, player_x=0xBCD5,
         player_health=0x0116, guard_health=0x0114, scene=0x00EA, level=0x0130,
         fight_phase=0x00FA, guard_present=0xD5AA, guard_aggression=0xD5AC,
         player_down=0x00F8, section_state=0x012C, fight_param_1=0x0106,
         story_branch=0xD67C, level_right=0x0104, level_left=0x0102,
         guard_just_hit=0x00FE, player_striking=0x00EC, restricted_mode=0x00F0,
         demo_mode=0x0156, fight_state=0x0154, hard_mode=0x00F2,
         section_flag=0x012E)

ap = argparse.ArgumentParser()
ap.add_argument("--budget", type=int, default=3_000_000_000)
ap.add_argument("--tag", default="run1")
ap.add_argument("--eagle-window", default="56,63", help="eagle distance at which to strike, lo,hi")
ap.add_argument("--max-deaths", type=int, default=1)
ap.add_argument("--film", type=int, default=0, help="capture every Nth frame during the eagle, the gate and the last room")
ap.add_argument("--toolkit", default=str(ROOT.parent.parent / "DOS-Decompiler"),
                help="the DOS-Decompiler checkout (needs Python with unicorn and capstone)")
args = ap.parse_args()
sys.path.insert(0, str(Path(args.toolkit) / "tools"))
import comrun  # noqa: E402

OUT = ROOT / "review" / "playthrough" / args.tag      # review/ is gitignored: frames are the game
(OUT / "frames").mkdir(parents=True, exist_ok=True)

m = comrun.Machine((ROOT / "original" / "KARATEKA.EXE").read_bytes(), keys=[],
                   files=ROOT / "original")
m.keyboard, m.hw_every = "auto", comrun.KEY_EVERY
m.timer, m.timer_every = "auto", comrun.TIMER_EVERY
m.no_joystick = True
m.cpu = "8088"
m.set_adapter("cga")
m.enable_bios_text(None)


def w(name):
    return struct.unpack("<h", bytes(m.read(DS + G[name], 2)))[0]


def state():
    return {k: w(k) for k in G}


log = (OUT / "log.jsonl").open("w", encoding="utf-8")
events = (OUT / "events.txt").open("w", encoding="utf-8")
t0 = time.time()
last = {"scene": None, "level": None}
nframe = [0]
started = [False]
deaths = [0]
decisions = [0]
strike_toggle = [0]


def ev(text):
    line = f"{m.steps:>13,}  {time.time() - t0:7.0f}s  {text}"
    events.write(line + "\n"); events.flush(); print(line, flush=True)


def frame(label):
    nframe[0] += 1
    path = OUT / "frames" / f"{nframe[0]:03d}-{label}.png"
    comrun.draw_screen(m, str(path))
    ev(f"frame {path.name}")


def give(ch):
    m._at_arrival(m.uc, 0x206D + m.img_bias, 0x206D, ord(ch))


EAGLE_LO, EAGLE_HI = (int(v) for v in args.eagle_window.split(","))
PUNCH = {0: "q", 12: "a", 24: "z"}         # aggression -> the punch whose pose it admits


def decide(s):
    """One key, or None, for the state at a decision point."""
    if s["player_down"]:
        return None
    d = s["guard_x"] - s["player_x"]
    pose = s["player_pose"]
    in_stance = pose <= 63
    # Mariko: approach upright, never in the stance.
    if s["restricted_mode"] == 1:
        return " " if in_stance else "6"
    if not in_stance:
        return " "                         # drop into the stance first
    # The eagle: stand still and punch at the height it was dealt.
    if s["guard_present"] == 1:
        if s["guard_pose"] == 31 and EAGLE_LO <= d <= EAGLE_HI:
            return PUNCH.get(s["guard_aggression"], "a")
        return None
    # A guard close by is fought before anything else.
    if s["guard_present"] == 0 and s["fight_phase"] == 0 and -10 < d < 70:
        strike_toggle[0] ^= 1
        return "x" if strike_toggle[0] else "w"   # low kick, high kick
    # The death gate, on the fortress wall.
    if s["scene"] == 2:
        lead = s["fight_param_1"] - s["player_x"]
        armed = s["section_state"] == 0 and s["story_branch"] <= 0
        if 0x20 < lead < 0x5E + 40:
            if armed:
                if 0x3E <= lead < 0x5E:
                    return "q" if s["fight_phase"] > 0 else None   # set it off from out of reach
                if lead >= 0x5E:
                    if lead - 40 >= 0x3E:
                        return "6"                 # a full step stays out of reach
                    if pose == 1 and lead - 20 >= 0x3E:
                        return "6"                 # from the stance a step is 20 px
                    return None                    # let the walk settle into the stance
                return "6"                         # inside the reach while armed: nothing better
            return "6"                             # falling, down (the wall holds us at 68), rising: go
    # Inside the fortress a room opens only to a kick past x 236 once its guard
    # is down (resolve_strikes reaches next_section only on a striking frame
    # with pose >= 5); walking into the closed wall is a scripted hit.
    if s["scene"] >= 3 and s["guard_present"] == 0 and s["section_flag"] == 0:
        if s["fight_phase"] > 0 and s["player_x"] > 236:
            return "x"
        if s["fight_phase"] > 0:
            return "6"     # x 237..251 is reached by one bump off the closed wall (it knocks back 4)
        if s["player_x"] + 40 >= s["level_right"]:
            return None    # the room's guard is not beaten yet: do not walk into the wall
    near_guard = s["guard_present"] == 0 and s["fight_phase"] == 0 and -10 < d < 70
    if near_guard:
        strike_toggle[0] ^= 1
        return "x" if strike_toggle[0] else "w"   # low kick, high kick
    return "6"                             # step forward


def on_decision(_off):
    decisions[0] += 1
    s = state()
    if s["scene"] != last["scene"] or s["level"] != last["level"]:
        ev(f"scene {s['scene']} level {s['level']}  x {s['player_x']}  {s}")
        last.update(scene=s["scene"], level=s["level"])
        frame(f"scene{s['scene']}-level{s['level']}")
    k = decide(s)
    s["key"] = k
    s["steps"] = m.steps
    log.write(json.dumps(s) + "\n")
    if decisions[0] % 500 == 0:
        log.flush()
        frame(f"d{decisions[0]}")
    if k:
        give(k)


frames_log = (OUT / "frames.jsonl").open("w", encoding="utf-8")


film_n = [0]


def on_frame(_off):
    if args.film:
        hot = (w("guard_present") == 1 or (w("scene") == 2 and (w("section_state") or w("story_branch")))
               or w("scene") == 4)
        if hot:
            film_n[0] += 1
            if film_n[0] % args.film == 0:
                nframe[0] += 1
                comrun.draw_screen(m, str(OUT / "frames" / f"{nframe[0]:04d}-film.png"))
    if w("guard_present") == 1 or (w("scene") == 2 and (w("section_state") or w("story_branch"))):
        frames_log.write(json.dumps({"steps": m.steps, **{k: w(k) for k in (
            "player_pose", "player_striking", "player_x", "guard_pose", "guard_x",
            "guard_aggression", "guard_health", "player_health", "section_state",
            "story_branch", "fight_param_1", "scene", "level")}}) + chr(10))


def on_read_intent(_off):
    if not started[0] and m.steps > 3_000_000:
        started[0] = True
        m.keys.append(0x20)        # space: leave the attract, start the game
        m._sync_kbd()
        ev("start key")


def on_the_end(_off):
    deaths[0] += 1
    ev(f"THE END card (death {deaths[0]})")
    frame(f"the-end-{deaths[0]}")
    if deaths[0] >= args.max_deaths:
        m.stopped = "the end card"
        m.uc.emu_stop()


def on_closing(_off):
    ev("CLOSING CARD reached")
    frame("closing")
    m.stopped = "the closing card"
    m.uc.emu_stop()


m.watch[0x206D] = on_decision
m.watch[0x2BDD] = on_frame           # resolve_strikes, once a frame
m.watch[0x4149] = on_read_intent
m.watch[0x3F6A] = on_the_end        # card_the_end, after its blit
m.watch[0x3F9D] = on_closing        # card_closing, after its blit

why = m.run(None, budget=args.budget)
ev(f"stopped: {why}; decisions {decisions[0]}; deaths {deaths[0]}")
frame("last")
log.close(); events.close(); frames_log.close()
