/*
 * Spyder — the boss system.
 *
 * A boss is a critter with phases, hit stop, procedural audio roar,
 * and integration with the room's work-order and extra goals.
 */
(function () {
  'use strict';

  const S = window.Spyder = window.Spyder || {};

  const registry = new Map();

  class Boss {
    constructor(def, world, opts = {}) {
      this.def = def;
      this.id = def.id;
      this.name = def.name;
      this.maxHealth = def.health || 60;
      this.health = this.maxHealth;
      this.phases = def.phases || [{ id: 'default', at: 1.0 }];
      this.phase = this.phases[0]?.id || 'default';
      this.alive = true;
      this.done = false;
      this.isBoss = true;
      this.flash = 0;
      this.hitStop = 0;
      this.dying = false;
      this.deathTimer = 0;
      this.deathDuration = 0.8; // the stand-in's death: scale and alpha 1 -> 0 over 0.8s of sim time
      this.x = opts.x ?? 960;
      this.y = opts.y ?? 400;
      this.radius = opts.radius ?? 60;
      this.points = opts.points ?? 500;
    }

    hitTest(x, y, r = 0) {
      return Math.hypot(x - this.x, y - this.y) <= (this.radius + r);
    }

    hit(world, damage = 1, weaponId = 'vacuum') {
      if (!this.alive) return false;
      this.health = Math.max(0, this.health - damage);
      this.flash = 1;
      this.hitStop = 0.04;
      if (world && world.shake) world.shake(0.3);
      if (this.health <= 0) {
        this.die(world);
      }
      return true;
    }

    enterPhase(phaseId) {
      this.phase = phaseId;
    }

    // The stand-in's own death: not game art, just enough to prove the
    // framework. A custom boss (from `create()`) overrides this and sets
    // `done` itself when its own death animation finishes.
    die(world) {
      this.alive = false;
      this.dying = true;
      this.deathTimer = 0;
    }

    update(dt, world) {
      if (this.hitStop > 0) {
        this.hitStop -= dt;
        return;
      }
      if (this.flash > 0) {
        this.flash = Math.max(0, this.flash - dt * 6);
      }
      if (this.dying && !this.done) {
        this.deathTimer += dt;
        const t = Math.min(1, this.deathTimer / this.deathDuration);
        this.deathScale = 1 - t;
        this.deathAlpha = 1 - t;
        if (t >= 1) this.done = true;
      }
    }

    draw(ctx) {
      if (this.done) return;
      ctx.save();
      if (this.dying) ctx.globalAlpha = Math.max(0, this.deathAlpha ?? 1);
      const r = this.dying ? this.radius * Math.max(0, this.deathScale ?? 1) : this.radius;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fillStyle = this.flash > 0 ? '#FFFFFF' : '#2A1F17';
      ctx.fill();
      ctx.strokeStyle = '#8A2A1A';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    drawGlow(ctx, light) {
      if (!this.alive) return;
      if (S.light && S.light.glow) {
        S.light.glow(ctx, this.x, this.y, this.radius * 1.5, '#E88A6A', 0.3);
      }
    }
  }

  S.Boss = Boss;

  S.bosses = {
    register(def) {
      if (!def.id) throw new Error('Boss registration requires an id');
      registry.set(def.id, def);
      return def;
    },
    get(id) {
      return registry.get(id);
    },
    has(id) {
      return registry.has(id);
    },
    list() {
      return Array.from(registry.values());
    },
    clear() {
      registry.clear();
    },
  };
})();
