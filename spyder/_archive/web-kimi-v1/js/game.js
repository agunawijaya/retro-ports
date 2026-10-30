(() => {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start-btn');
  const scoreEl = document.getElementById('score');
  const comboEl = document.getElementById('combo-box');
  const comboText = document.getElementById('combo');
  const cleanEl = document.getElementById('clean');
  const healthFill = document.getElementById('health-fill');

  let width, height;
  let lastTime = 0;
  let state = 'menu';
  let animationId;

  const GAME_WIDTH = 1200;
  const GAME_HEIGHT = 800;

  const player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 90,
    width: 44,
    height: 70,
    speed: 360,
    color: '#ff9a3c',
    health: 100,
    maxHealth: 100,
    cooldown: 0,
    fireRate: 0.22,
    facing: 1,
    anim: 0
  };

  const keys = {};
  const projectiles = [];
  const spiders = [];
  const particles = [];
  const webs = [];
  const dust = [];

  let score = 0;
  let combo = 1;
  let comboTimer = 0;
  let spidersSpawned = 0;
  let spidersKilled = 0;
  const TOTAL_SPIDERS = 25;
  let spawnTimer = 0;
  let spawnInterval = 1.6;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    const scale = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
    canvas.style.transform = `scale(${scale})`;
    canvas.style.transformOrigin = 'top left';
    canvas.style.width = `${GAME_WIDTH}px`;
    canvas.style.height = `${GAME_HEIGHT}px`;
  }

  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyP' && state === 'playing') pause();
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (state === 'playing') {
      shoot();
      e.preventDefault();
    }
  });

  startBtn.addEventListener('click', startGame);

  if (window.location.search.includes('autostart=1')) {
    setTimeout(startGame, 100);
  }

  function startGame() {
    overlay.classList.add('hidden');
    resetGame();
    state = 'playing';
    lastTime = performance.now();
    cancelAnimationFrame(animationId);
    loop(lastTime);
  }

  function pause() {
    state = 'paused';
    overlay.classList.remove('hidden');
    document.getElementById('title').textContent = 'PAUSED';
    document.getElementById('subtitle').textContent = 'Press Start to continue';
    document.getElementById('controls').style.display = 'none';
    startBtn.textContent = 'Resume';
  }

  function resetGame() {
    player.x = GAME_WIDTH / 2;
    player.health = player.maxHealth;
    player.cooldown = 0;
    projectiles.length = 0;
    spiders.length = 0;
    particles.length = 0;
    webs.length = 0;
    dust.length = 0;
    score = 0;
    combo = 1;
    comboTimer = 0;
    spidersSpawned = 0;
    spidersKilled = 0;
    spawnTimer = 0;
    spawnInterval = 1.6;
    updateUI();
    initWebs();
    initDust();
  }

  function initWebs() {
    for (let i = 0; i < 12; i++) {
      webs.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * (GAME_HEIGHT * 0.55),
        radius: 30 + Math.random() * 60,
        points: 5 + Math.floor(Math.random() * 5),
        sway: Math.random() * Math.PI * 2,
        opacity: 0.04 + Math.random() * 0.08
      });
    }
  }

  function initDust() {
    for (let i = 0; i < 40; i++) {
      dust.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 4 - 2,
        size: 0.5 + Math.random() * 1.5,
        alpha: 0.1 + Math.random() * 0.3
      });
    }
  }

  function spawnSpider() {
    if (spidersSpawned >= TOTAL_SPIDERS) return;

    const type = Math.random() < 0.55 ? 'string' : 'wall';
    const margin = 80;

    if (type === 'string') {
      spiders.push({
        type: 'string',
        x: margin + Math.random() * (GAME_WIDTH - margin * 2),
        y: -40,
        width: 22,
        height: 26,
        vy: 60 + Math.random() * 50,
        phase: Math.random() * Math.PI * 2,
        swaySpeed: 1 + Math.random(),
        health: 1,
        maxHealth: 1,
        state: 'descending',
        threadLength: 0
      });
    } else {
      const side = Math.random() < 0.5 ? 'left' : 'right';
      spiders.push({
        type: 'wall',
        x: side === 'left' ? 30 : GAME_WIDTH - 30,
        y: 80 + Math.random() * (GAME_HEIGHT * 0.5),
        width: 28,
        height: 22,
        vx: side === 'left' ? 80 + Math.random() * 40 : -(80 + Math.random() * 40),
        vy: 20 + Math.random() * 30,
        health: 2,
        maxHealth: 2,
        side,
        legPhase: Math.random() * Math.PI * 2
      });
    }

    spidersSpawned++;
  }

  function shoot() {
    if (player.cooldown > 0) return;
    player.cooldown = player.fireRate;

    projectiles.push({
      x: player.x,
      y: player.y - 30,
      width: 8,
      height: 24,
      vy: -900,
      life: 2
    });

    spawnParticles(player.x, player.y - 30, 3, '#ffffff', 40);
  }

  function spawnParticles(x, y, count, color, speed = 60) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const vel = Math.random() * speed + 20;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0,
        color,
        size: 1 + Math.random() * 3
      });
    }
  }

  function update(dt) {
    if (state !== 'playing') return;

    // Player movement
    let moving = false;
    if (keys['ArrowLeft'] || keys['KeyA']) {
      player.x -= player.speed * dt;
      player.facing = -1;
      moving = true;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
      player.x += player.speed * dt;
      player.facing = 1;
      moving = true;
    }

    player.x = Math.max(player.width / 2, Math.min(GAME_WIDTH - player.width / 2, player.x));
    player.anim += moving ? dt * 12 : 0;

    if (player.cooldown > 0) player.cooldown -= dt;
    if (keys['Space'] || keys['PointerDown']) shoot();

    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.y < -50 || p.life <= 0) {
        projectiles.splice(i, 1);
      }
    }

    // Spawning
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnSpider();
      spawnTimer = 0;
      spawnInterval = Math.max(0.5, spawnInterval - 0.03);
    }

    // Spiders
    for (let i = spiders.length - 1; i >= 0; i--) {
      const s = spiders[i];

      if (s.type === 'string') {
        s.phase += dt * s.swaySpeed;
        const sway = Math.sin(s.phase) * 20 * dt;
        s.x += sway;
        s.y += s.vy * dt;
        s.threadLength = s.y + 40;

        if (s.y > GAME_HEIGHT * 0.55) {
          s.vy *= -1;
          s.state = 'ascending';
        }
        if (s.y < -50) {
          spiders.splice(i, 1);
          continue;
        }
      } else {
        s.legPhase += dt * 12;
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        if (s.x < 40 || s.x > GAME_WIDTH - 40) s.vx *= -1;
        if (s.y < 60 || s.y > GAME_HEIGHT * 0.65) s.vy *= -1;
      }

      // Collision with player
      if (rectIntersect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height,
                        player.x - player.width / 2, player.y - player.height / 2, player.width, player.height)) {
        player.health -= 15;
        spawnParticles(s.x, s.y, 8, '#ff6b6b', 80);
        spiders.splice(i, 1);
        resetCombo();
        if (player.health <= 0) gameOver();
        continue;
      }

      // Collision with projectiles
      for (let j = projectiles.length - 1; j >= 0; j--) {
        const p = projectiles[j];
        if (rectIntersect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height,
                          p.x - p.width / 2, p.y - p.height / 2, p.width, p.height)) {
          s.health--;
          projectiles.splice(j, 1);
          spawnParticles(p.x, p.y, 4, '#ffffff', 50);

          if (s.health <= 0) {
            killSpider(s, i);
            break;
          }
        }
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.maxLife = p.maxLife || p.life;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Combo decay
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        combo = 1;
        updateUI();
      }
    }

    // Dust
    for (const d of dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < 0) d.x = GAME_WIDTH;
      if (d.x > GAME_WIDTH) d.x = 0;
      if (d.y < 0) d.y = GAME_HEIGHT;
      if (d.y > GAME_HEIGHT) d.y = 0;
    }

    // Webs sway
    for (const w of webs) {
      w.sway += dt * 0.5;
    }

    updateUI();
  }

  function killSpider(s, index) {
    const basePoints = s.type === 'string' ? 100 : 150;
    score += basePoints * combo;
    combo = Math.min(combo + 1, 5);
    comboTimer = 2.5;
    spidersKilled++;

    spawnParticles(s.x, s.y, 12, s.type === 'string' ? '#b8a89a' : '#9a8b7a', 100);
    spiders.splice(index, 1);

    comboEl.classList.add('pop');
    setTimeout(() => comboEl.classList.remove('pop'), 100);
  }

  function resetCombo() {
    combo = 1;
    comboTimer = 0;
  }

  function rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  function updateUI() {
    scoreEl.textContent = Math.floor(score).toLocaleString();
    comboText.textContent = combo;
    const clean = Math.min(100, Math.floor((spidersKilled / TOTAL_SPIDERS) * 100));
    cleanEl.textContent = clean;
    healthFill.style.width = `${Math.max(0, player.health)}%`;
  }

  function gameOver() {
    state = 'gameover';
    overlay.classList.remove('hidden');
    document.getElementById('title').textContent = 'GAME OVER';
    document.getElementById('subtitle').textContent = `Score: ${Math.floor(score).toLocaleString()} · Clean: ${Math.floor((spidersKilled / TOTAL_SPIDERS) * 100)}%`;
    document.getElementById('controls').style.display = 'none';
    startBtn.textContent = 'Try Again';
  }

  function draw() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    drawWebs();
    drawDust();
    drawProjectiles();
    drawSpiders();
    drawPlayer();
    drawParticles();
  }

  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.scale(player.facing, 1);

    // Body
    ctx.fillStyle = '#ff9a3c';
    roundRect(-16, -55, 32, 46, 8);
    ctx.fill();

    // Head
    ctx.fillStyle = '#ffd6a5';
    ctx.beginPath();
    ctx.arc(0, -60, 14, 0, Math.PI * 2);
    ctx.fill();

    // Goggles / mask
    ctx.fillStyle = '#3a2e24';
    ctx.beginPath();
    ctx.roundRect(-11, -64, 22, 10, 3);
    ctx.fill();

    // Helmet/hood
    ctx.fillStyle = '#ff8c42';
    ctx.beginPath();
    ctx.arc(0, -60, 14, Math.PI, 0);
    ctx.fill();

    // Backpack tank
    ctx.fillStyle = '#5c4a3d';
    roundRect(-22, -48, 8, 34, 3);
    ctx.fill();

    // Gun arm
    const armAngle = Math.sin(player.anim) * 0.1;
    ctx.save();
    ctx.translate(14, -38);
    ctx.rotate(armAngle);
    ctx.fillStyle = '#ffd6a5';
    roundRect(0, -4, 22, 8, 3);
    ctx.fill();

    // Vacuum gun
    ctx.fillStyle = '#7a8b94';
    roundRect(18, -7, 28, 12, 4);
    ctx.fill();
    ctx.fillStyle = '#a4b4bc';
    roundRect(42, -9, 8, 16, 3);
    ctx.fill();
    ctx.restore();

    // Legs
    ctx.fillStyle = '#3d4a52';
    const legOffset = Math.sin(player.anim) * 6;
    roundRect(-12 + legOffset, -10, 9, 28, 4);
    ctx.fill();
    roundRect(3 - legOffset, -10, 9, 28, 4);
    ctx.fill();

    ctx.restore();
  }

  function drawSpiders() {
    for (const s of spiders) {
      ctx.save();
      ctx.translate(s.x, s.y);

      if (s.type === 'string') {
        // Thread
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -s.y - 40);
        ctx.lineTo(0, 0);
        ctx.stroke();

        // Body
        ctx.fillStyle = '#6b5a4a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs hanging
        ctx.strokeStyle = '#7a6a5a';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + s.phase * 0.5;
          const len = 12 + Math.sin(s.phase + i) * 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
          ctx.stroke();
        }

        // Eyes
        ctx.fillStyle = '#ffcc80';
        ctx.beginPath();
        ctx.arc(-3, -5, 2, 0, Math.PI * 2);
        ctx.arc(3, -5, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Wall crawler
        const legWiggle = Math.sin(s.legPhase) * 3;

        ctx.fillStyle = '#5a4a3a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#6b5a4a';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 8; i++) {
          const side = i < 4 ? -1 : 1;
          const row = i % 4;
          const x = side * (8 + row * 2);
          const y = -6 + row * 4;
          ctx.beginPath();
          ctx.moveTo(x * 0.5, y);
          ctx.quadraticCurveTo(x + legWiggle * side, y - 8, x + legWiggle * side * 1.5, y + 4);
          ctx.stroke();
        }

        ctx.fillStyle = '#e0c8a0';
        ctx.beginPath();
        ctx.arc(-4, -2, 2.5, 0, Math.PI * 2);
        ctx.arc(4, -2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function drawProjectiles() {
    ctx.save();
    for (const p of projectiles) {
      // Vacuum blast
      const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y - p.height);
      grad.addColorStop(0, 'rgba(255, 204, 128, 0.9)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.1)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - p.height / 2, p.width / 2, p.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 230, 180, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - p.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWebs() {
    for (const w of webs) {
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(Math.sin(w.sway) * 0.05);
      ctx.strokeStyle = `rgba(255, 255, 255, ${w.opacity})`;
      ctx.lineWidth = 0.8;

      for (let i = 0; i < w.points; i++) {
        const angle = (i / w.points) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * w.radius, Math.sin(angle) * w.radius);
        ctx.stroke();
      }

      for (let r = 0.2; r <= 1; r += 0.2) {
        ctx.beginPath();
        ctx.arc(0, 0, w.radius * r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  function drawDust() {
    ctx.fillStyle = '#ffffff';
    for (const d of dust) {
      ctx.globalAlpha = d.alpha;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    update(dt);
    draw();

    animationId = requestAnimationFrame(loop);
  }

  // Initial render for menu background
  initWebs();
  initDust();
  draw();
})();
