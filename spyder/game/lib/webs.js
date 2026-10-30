/*
 * Spyder — procedural cobwebs.
 *
 * A web is a hub with spokes running out to anchor points (ceiling, wall,
 * furniture), and rings of sagging silk between neighbouring spokes.
 * Every piece of silk is its own segment and can be torn by a dart, which
 * is what makes clearing a room feel physical.
 *
 * Old cobwebs in abandoned houses are also matted and grey, not pretty
 * orb webs, so a web can carry a "sheet": a dusty translucent film that
 * thins out as the strands around it are torn.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  class Web {
    /*
     * hub      [x, y] centre of the web
     * anchors  list of [x, y] where spokes attach, in angular order
     * rings    how many silk rings (4–9 reads well)
     * closed   true when anchors go all the way round (an orb web hanging
     *          in a doorway); false for corner webs, which leave a gap
     * sheet    0..1 opacity of the dusty film
     */
    constructor({ hub, anchors, rings = 6, closed = false, sheet = 0.5, seed = 1, sag = 1 }) {
      this.hub = { x: hub[0], y: hub[1] };
      this.anchors = anchors.map(([x, y]) => ({ x, y }));
      this.closed = closed;
      this.sheetStrength = sheet;
      this.seed = seed;
      this.noise = S.createNoise(seed);
      this.rng = S.createRng(seed * 31);
      this.shake = 0;
      this.falling = 0; // 0..1 during the makeover
      this.fallVelocity = 0;

      // Ring fractions are uneven on purpose: real webs are not tidy.
      this.fractions = [];
      for (let i = 1; i <= rings; i++) {
        const even = i / (rings + 1);
        this.fractions.push(S.clamp(even + this.rng.range(-0.04, 0.04), 0.06, 0.95));
      }

      this.segments = [];
      const spokeCount = this.anchors.length;

      // Spoke pieces: hub → ring 1 → ring 2 … → anchor.
      for (let s = 0; s < spokeCount; s++) {
        const stops = [0, ...this.fractions, 1];
        for (let k = 0; k < stops.length - 1; k++) {
          this.segments.push({ type: 'spoke', spoke: s, f0: stops[k], f1: stops[k + 1], alive: true });
        }
      }

      // Ring pieces between neighbouring spokes, sagging under gravity.
      const lastSpoke = closed ? spokeCount : spokeCount - 1;
      for (let s = 0; s < lastSpoke; s++) {
        for (const f of this.fractions) {
          // A few rings are missing from the start — old webs are patchy.
          if (this.rng.chance(0.12)) continue;
          this.segments.push({
            type: 'ring',
            spokeA: s,
            spokeB: (s + 1) % spokeCount,
            f,
            sag: (6 + f * 22) * sag * this.rng.range(0.6, 1.3),
            beads: this.rng.chance(0.35),
            alive: true,
          });
        }
      }

      this.total = this.segments.length;
      this.frays = []; // torn ends that dangle for a while
      this.pointsCache = this.segments.map(() => ({}));
    }

    get aliveCount() {
      let n = 0;
      for (const seg of this.segments) if (seg.alive) n++;
      return n;
    }

    get intactness() {
      return this.aliveCount / this.total;
    }

    // Where a point at fraction f along spoke s is right now (with sway).
    spokePoint(s, f, time) {
      const anchor = this.anchors[s];
      const swayX = (this.noise(time * 0.4 + this.seed) * 6 + Math.sin(time * 9) * this.shake * 10) * (1 - f);
      const swayY = (this.noise(time * 0.33 + this.seed + 9) * 4) * (1 - f);
      const drop = this.falling * this.falling * 600 * (1 - f * 0.4);
      return {
        x: S.lerp(this.hub.x, anchor.x, f) + swayX,
        y: S.lerp(this.hub.y, anchor.y, f) + swayY + drop,
      };
    }

    // Each segment as a quadratic: start, control, end.
    segmentCurve(seg, time) {
      if (seg.type === 'spoke') {
        const a = this.spokePoint(seg.spoke, seg.f0, time);
        const b = this.spokePoint(seg.spoke, seg.f1, time);
        return { a, c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 2 }, b };
      }
      const a = this.spokePoint(seg.spokeA, seg.f, time);
      const b = this.spokePoint(seg.spokeB, seg.f, time);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      // Sag downward, and a little toward the hub, like silk under its own weight.
      const towardHubX = (this.hub.x - mx) * 0.08;
      const towardHubY = (this.hub.y - my) * 0.08;
      return { a, c: { x: mx + towardHubX, y: my + seg.sag + towardHubY }, b };
    }

    /*
     * A dart travelled from (ax,ay) to (bx,by). Tear every strand it crossed,
     * plus any strand close to the impact — a single pop should visibly rip
     * a hole, not snip one thread. Returns the torn segments' midpoints.
     */
    tear(ax, ay, bx, by, time, radius = 34) {
      const hits = [];
      for (const seg of this.segments) {
        if (!seg.alive) continue;
        const { a, c, b } = this.segmentCurve(seg, time);
        const mid = S.quadPoint(a.x, a.y, c.x, c.y, b.x, b.y, 0.5);
        const crossed =
          S.segmentIntersection(ax, ay, bx, by, a.x, a.y, mid.x, mid.y) ||
          S.segmentIntersection(ax, ay, bx, by, mid.x, mid.y, b.x, b.y);
        if (crossed) hits.push({ x: crossed.x, y: crossed.y });
      }
      if (!hits.length) return [];

      const torn = [];
      for (const seg of this.segments) {
        if (!seg.alive) continue;
        const { a, c, b } = this.segmentCurve(seg, time);
        const mid = S.quadPoint(a.x, a.y, c.x, c.y, b.x, b.y, 0.5);
        if (hits.some((h) => Math.hypot(h.x - mid.x, h.y - mid.y) < radius)) {
          seg.alive = false;
          torn.push(mid);
          this.frays.push({ x: a.x, y: a.y, len: this.rng.range(10, 26), age: 0, life: 2.2 });
          this.frays.push({ x: b.x, y: b.y, len: this.rng.range(10, 26), age: 0, life: 2.2 });
        }
      }
      this.shake = 1;
      return torn;
    }

    update(dt) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      if (this.falling > 0 && this.falling < 1) {
        this.fallVelocity += dt * 1.6;
        this.falling = Math.min(1, this.falling + this.fallVelocity * dt);
      }
      for (let i = this.frays.length - 1; i >= 0; i--) {
        this.frays[i].age += dt;
        if (this.frays[i].age > this.frays[i].life) this.frays.splice(i, 1);
      }
    }

    // Makeover: whatever is left lets go and drops away.
    release() {
      if (this.falling === 0) this.falling = 0.001;
    }

    draw(ctx, time, alphaScale = 1) {
      const fade = (1 - this.falling) * alphaScale;
      if (fade <= 0.01) return;

      // The dusty film goes first, underneath the silk.
      const sheet = this.sheetStrength * Math.pow(this.intactness, 1.5) * fade;
      if (sheet > 0.01) this.drawSheet(ctx, time, sheet);

      // Batch the silk into three paths (spokes, rings, dust beads): one
      // stroke call per web instead of one per strand.
      const spokes = new Path2D();
      const rings = new Path2D();
      const beads = new Path2D();
      for (const seg of this.segments) {
        if (!seg.alive) continue;
        const { a, c, b } = this.segmentCurve(seg, time);
        const path = seg.type === 'spoke' ? spokes : rings;
        path.moveTo(a.x, a.y);
        path.quadraticCurveTo(c.x, c.y, b.x, b.y);
        if (seg.beads) {
          for (let t = 0.2; t < 0.9; t += 0.22) {
            const p = S.quadPoint(a.x, a.y, c.x, c.y, b.x, b.y, t);
            beads.moveTo(p.x + 1.3, p.y);
            beads.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
          }
        }
      }
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = S.rgba(P.silk, 0.5 * fade);
      ctx.lineWidth = 1.4;
      ctx.stroke(spokes);
      ctx.strokeStyle = S.rgba(P.silk, 0.36 * fade);
      ctx.lineWidth = 1.05;
      ctx.stroke(rings);
      ctx.fillStyle = S.rgba(P.linen, 0.45 * fade);
      ctx.fill(beads);

      // Torn ends curl and hang for a moment.
      for (const f of this.frays) {
        const k = 1 - f.age / f.life;
        const swing = Math.sin(time * 3 + f.x) * 6;
        ctx.strokeStyle = S.rgba(P.silk, 0.45 * k * fade);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.quadraticCurveTo(f.x + swing, f.y + f.len * 0.6, f.x + swing * 0.4, f.y + f.len * (0.6 + f.age * 0.3));
        ctx.stroke();
      }
      ctx.restore();
    }

    drawSheet(ctx, time, alpha) {
      const pts = this.anchors.map((_, s) => this.spokePoint(s, 0.72, time));
      const hub = this.spokePoint(0, 0, time);
      ctx.save();
      const g = ctx.createRadialGradient(hub.x, hub.y, 0, hub.x, hub.y, this.radius());
      g.addColorStop(0, S.rgba(P.linen, 0.3 * alpha));
      g.addColorStop(0.7, S.rgba(P.linen, 0.16 * alpha));
      g.addColorStop(1, S.rgba(P.linen, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(hub.x, hub.y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      if (this.closed) ctx.closePath();
      else ctx.lineTo(hub.x, hub.y);
      ctx.fill();
      ctx.restore();
    }

    // Extra pass after lighting: strands catch light and shimmer.
    drawGlints(ctx, time, light) {
      const fade = 1 - this.falling;
      if (fade <= 0.01) return;
      // Strands are sorted into four brightness buckets so each bucket is a
      // single stroke call.
      const buckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      let any = false;
      for (const seg of this.segments) {
        if (!seg.alive) continue;
        const { a, c, b } = this.segmentCurve(seg, time);
        const lit = Math.min(1, light.brightnessAt(c.x, c.y));
        if (lit < 0.15) continue;
        // A slow shimmer travels across the web.
        const shimmer = 0.5 + 0.5 * Math.sin(time * 1.6 + (c.x + c.y) * 0.02);
        const level = Math.min(3, Math.floor(lit * shimmer * 4));
        buckets[level].moveTo(a.x, a.y);
        buckets[level].quadraticCurveTo(c.x, c.y, b.x, b.y);
        any = true;
      }
      if (!any) return;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.2;
      buckets.forEach((path, level) => {
        ctx.strokeStyle = S.rgba(P.bone, ((level + 0.5) / 4) * 0.5 * fade);
        ctx.stroke(path);
      });
      ctx.restore();
    }

    radius() {
      let r = 0;
      for (const a of this.anchors) r = Math.max(r, Math.hypot(a.x - this.hub.x, a.y - this.hub.y));
      return r;
    }
  }

  S.Web = Web;
})();
