'use strict';

const Defense = (() => {
  let canvas, ctx, animId;
  let S;
  let resizeHandler = null;

  const GAME_W = 960;
  const GND    = 0.757;   // 0.72 + 20px/540
  const BASE_R = 0.22;
  const BASE_W = 56;

  // バリケード画像
  const KABE_IMG = new Image();
  KABE_IMG.src = 'images/kabe_1.png';

  // 背景画像（10日ごとに切り替え）
  const BG_IMGS = [1, 2, 3, 4].map(n => {
    const img = new Image();
    img.src = `images/bgimg_0${n}.png`;
    return img;
  });

  // ゾンビスプライト（タイプごとに3枚）
  const ZOMBIE_IMGS = {
    walker: [1, 2, 3].map(n => {
      const img = new Image();
      img.src = `images/zombie_z1_${n}.png`;
      return img;
    }),
    runner: [1, 2, 3, 4].map(n => {
      const img = new Image();
      img.src = `images/zombie_z2_${n}.png`;
      return img;
    }),
    brute: [1, 2, 3, 4].map(n => {
      const img = new Image();
      img.src = `images/zombie_z3_${n}.png`;
      return img;
    }),
    flyer: [1, 2, 3, 4].map(n => {
      const img = new Image();
      img.src = `images/zombie_z4_${n}.png`;
      return img;
    }),
    boss_walker: [1, 2, 3, 4].map(n => {
      const img = new Image();
      img.src = `images/zombie_b1_${n}.png`;
      return img;
    }),
  };
  const ZOMBIE_WALK_SEQ = {
    walker:      [0, 1, 2, 1],
    runner:      [0, 1, 2, 3, 2, 1],
    brute:       [0, 1, 2, 3, 2, 1],
    flyer:       [0, 1, 2, 3, 2, 1],
    boss_walker: [0, 1, 2, 3, 2, 1],
  };
  const ZOMBIE_FRAME_DUR = 40;             // 1コマあたりのゲームフレーム数

  // 味方スプライト（キャラクターごとに3枚）
  const ALLY_IMGS = ['001', '002'].map(id =>
    [1, 2, 3].map(n => {
      const img = new Image();
      img.src = `images/zombie${id}_${n}.png`;
      return img;
    })
  );
  // 発砲アニメーション: 各フレームで使う画像インデックス(0-based)
  const SHOOT_SEQ      = [0, 1, 2, 1, 0];
  const SHOOT_FRAME_DUR = 3;  // 1コマあたりのゲームフレーム数

  function gh()    { return canvas.height * GAME_W / canvas.width; }
  function scale() { return canvas.width / GAME_W; }

  const ETYPES = {
    walker:      { hp: 60,  spd: 0.55, fly: false, w: 22, h: 36, col: '#8B1A1A', atk: 5,  gold: 1  },
    runner:      { hp: 30,  spd: 1.35, fly: false, w: 18, h: 28, col: '#CC5500', atk: 4,  gold: 1  },
    brute:       { hp: 220, spd: 0.28, fly: false, w: 34, h: 48, col: '#3A0A55', atk: 12, gold: 5  },
    flyer:       { hp: 48,  spd: 0.95, fly: true,  w: 28, h: 22, col: '#1A4A1A', atk: 8,  gold: 2  },
    boss_walker: { hp: 540, spd: 0.35, fly: false, w: 28, h: 44, col: '#8B1A1A', atk: 7,  gold: 40 },
  };

  function buildWave(day) {
    const count = 4 + day * 2;
    const q = [];
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      let type;
      if      (day <= 2) type = 'walker';
      else if (day <= 4) type = r < 0.55 ? 'walker' : 'runner';
      else if (day <= 7) type = r < 0.3 ? 'walker' : r < 0.6 ? 'runner' : r < 0.82 ? 'brute' : 'flyer';
      else               type = r < 0.2 ? 'walker' : r < 0.45 ? 'runner' : r < 0.72 ? 'brute' : 'flyer';

      const t = ETYPES[type];
      const hm = 1 + Math.max(0, day - 2) * 0.32;
      const sm = 1 + Math.max(0, day - 2) * 0.07;
      q.push({
        type, fly: t.fly,
        hp: Math.floor(t.hp * hm), maxHp: Math.floor(t.hp * hm),
        spd: t.spd * sm, w: t.w * 1.3, h: t.h * 1.3, col: t.col,
        atk: Math.floor(t.atk * hm), gold: Math.floor(t.gold * hm),
        alive: true, x: 0, y: 0, id: i,
        animT: 0, animF: 0, atkCd: 0,
        spriteSeq: 0, spriteTimer: ZOMBIE_FRAME_DUR,
      });
    }

    if (day === 10) {
      const t = ETYPES.boss_walker;
      const hm = 1 + Math.max(0, day - 2) * 0.32;
      const sm = 1 + Math.max(0, day - 2) * 0.07;
      q.push({
        type: 'boss_walker', fly: false,
        hp: Math.floor(t.hp * hm), maxHp: Math.floor(t.hp * hm),
        spd: t.spd * sm, w: t.w * 1.3, h: t.h * 1.3, col: t.col,
        atk: Math.floor(t.atk * hm), gold: Math.floor(t.gold * hm),
        alive: true, x: 0, y: 0, id: count,
        animT: 0, animF: 0, atkCd: 0,
        spriteSeq: 0, spriteTimer: ZOMBIE_FRAME_DUR,
      });
    }

    return q;
  }

  // ── public entry ──
  function start(day, opts = {}, onEnd = null) {
    canvas = document.getElementById('defense-canvas');
    ctx    = canvas.getContext('2d');
    resizeCanvas();
    resizeHandler = () => resizeCanvas();
    window.addEventListener('resize', resizeHandler);
    window.addEventListener('orientationchange', resizeHandler);

    const baseHpMax = opts.baseHpMax ?? 100;
    const baseDef   = opts.baseDef   ?? 0;
    const bombCount = opts.bombCount ?? 0;
    const allyCount      = opts.allyCount      ?? 1;
    const allyRangeRatio = opts.allyRangeRatio ?? 0.8;
    const allyAtk        = opts.allyAtk        ?? 20;
    const bombDmg   = allyAtk;   // ボム攻撃力 = 銃の攻撃力
    const allyAps      = opts.allyAps        ?? 0.75;
    const goldStart    = opts.goldStart      ?? 0;
    const speedUnlocked  = opts.speedUnlocked  ?? false;
    const speed3Unlocked = opts.speed3Unlocked ?? false;
    const speedActive    = opts.speedActive    ?? 1;

    S = {
      day, phase: 'playing',
      baseHp: opts.baseHpCurrent ?? baseHpMax, baseHpMax, baseDef,
      bombs: bombCount, bombDmg,
      allyAtk, allyAps, allyCount, allyRangeRatio,
      gold: goldStart, goldCheckpoint: goldStart,
      onEnd,
      enemies: [], allies: [], bullets: [], particles: [],
      spawnQ: buildWave(day),
      spawnIdx: 0, spawnTimer: 0,
      warningTimer: 0, warningShown: false,
      spawnInterval: Math.max(45, 110 - day * 8),
      shakeT: 0, shakeAmt: 0, flashT: 0, frame: 0,
      speed: typeof speedActive === 'number' ? speedActive : (speedActive ? 2 : 1),
      speed3Unlocked,
    };

    const speedBtn = document.getElementById('speed-btn');
    if (speedUnlocked) {
      speedBtn.classList.remove('hidden');
      updateSpeedBtn();
    } else {
      speedBtn.classList.add('hidden');
    }

    createAllies();
    bindControls();
    updateHUD();
    document.getElementById('defense-overlay').classList.add('hidden');

    if (animId) cancelAnimationFrame(animId);
    loop();
  }

  function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createAllies() {
    const gndY     = gh() * GND;
    const wallLeft = GAME_W * BASE_R - BASE_W / 2;
    const count    = S.allyCount;
    for (let i = 0; i < count; i++) {
      const allyW = 18;
      S.allies.push({
        x: wallLeft - allyW - 4 - i * 24, y: gndY - 40 + 5,
        w: allyW, h: 40,
        cd: 0, cdMax: Math.floor(60 / S.allyAps),
        atk: S.allyAtk,
        range: (GAME_W - (wallLeft - allyW - 4 - i * 24)) * S.allyRangeRatio,
        animSeqIdx: -1,   // -1 = 待機, 0〜4 = 発砲シーケンス中
        animTimer:   0,
      });
    }
  }

  // ── loop ──
  function loop() {
    animId = requestAnimationFrame(loop);
    const steps = S.phase === 'playing' ? S.speed : 1;
    for (let i = 0; i < steps; i++) {
      S.frame++;
      if (S.phase === 'playing') {
        spawnStep();
        moveEnemies();
        allyStep();
        allyAnimStep();
        bulletStep();
        particleStep();
        phaseCheck();
        if (S.phase !== 'playing') break;
      }
    }
    draw();
  }

  // ── spawn ──
  function spawnStep() {
    if (S.spawnIdx >= S.spawnQ.length) return;
    if (!S.warningShown && S.spawnQ[S.spawnIdx]?.type === 'boss_walker') {
      S.warningShown = true;
      S.warningTimer = 130;
    }
    const interval = S.spawnQ[S.spawnIdx]?.type === 'boss_walker'
      ? S.spawnInterval + 120
      : S.spawnInterval;
    if (++S.spawnTimer < interval) return;
    S.spawnTimer = 0;

    const gndY = gh() * GND;
    const e = S.spawnQ[S.spawnIdx++];
    e.x = GAME_W + e.w + 10;          // 常に固定距離から出現
    e.y = e.fly
      ? gh() * 0.22 + Math.random() * gh() * 0.2
      : gndY - e.h;
    S.enemies.push(e);
  }

  // ── enemies ──
  function moveEnemies() {
    const gndY     = gh() * GND;
    const contactX = GAME_W * BASE_R + BASE_W / 2;  // 壁の右端

    for (let i = S.enemies.length - 1; i >= 0; i--) {
      const e = S.enemies[i];
      if (!e.alive) { S.enemies.splice(i, 1); continue; }

      e.animT++;
      if (e.animT > 8) { e.animT = 0; e.animF = (e.animF + 1) % 4; }
      if (--e.spriteTimer <= 0) {
        const seq   = ZOMBIE_WALK_SEQ[e.type] ?? ZOMBIE_WALK_SEQ.walker;
        e.spriteSeq = (e.spriteSeq + 1) % seq.length;
        e.spriteTimer = ZOMBIE_FRAME_DUR;
      }

      if (e.x > contactX) {
        e.x -= e.spd;
      } else {
        if (++e.atkCd >= 60) {
          e.atkCd = 0;
          S.baseHp = Math.max(0, S.baseHp - Math.max(1, e.atk - S.baseDef));
          shake(7);
          burst(GAME_W * BASE_R + BASE_W / 2, gndY - 25, '#ff2200', 8);
          updateHUD();
        }
      }
    }
  }

  // ── allies ──
  function allyStep() {
    for (const a of S.allies) {
      if (a.cd > 0) { a.cd--; continue; }
      let tgt = null, best = Infinity;
      for (const e of S.enemies) {
        if (!e.alive) continue;
        const dx = e.x - a.x;
        if (dx > 0 && dx < a.range && dx < best) { best = dx; tgt = e; }
      }
      if (!tgt) continue;
      S.bullets.push({ x: a.x + a.w + 2, y: a.y + 12 - 50, tgt, dmg: a.atk, spd: 13, col: '#ffe050' });
      a.cd = a.cdMax;
      a.animSeqIdx = 0;
      a.animTimer  = SHOOT_FRAME_DUR;
    }
  }

  // ── ally animation ──
  function allyAnimStep() {
    for (const a of S.allies) {
      if (a.animSeqIdx < 0) continue;
      if (--a.animTimer > 0) continue;
      a.animSeqIdx++;
      if (a.animSeqIdx >= SHOOT_SEQ.length) {
        a.animSeqIdx = -1;  // 待機に戻る
      } else {
        a.animTimer = SHOOT_FRAME_DUR;
      }
    }
  }

  // ── bullets ──
  function bulletStep() {
    for (let i = S.bullets.length - 1; i >= 0; i--) {
      const b = S.bullets[i];
      if (!b.tgt.alive) { S.bullets.splice(i, 1); continue; }
      const tx = b.tgt.x + b.tgt.w / 2;
      const ty = b.tgt.y + b.tgt.h * 0.4 + (b.tgt.type === 'walker' ? -50 : b.tgt.type === 'boss_walker' ? -30 : 0);
      const dx = tx - b.x, dy = ty - b.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < b.spd + 4) {
        b.tgt.hp -= b.dmg;
        burst(tx, b.tgt.y + 8, b.tgt.col, 5);
        if (b.tgt.hp <= 0) {
          b.tgt.alive = false;
          S.gold += b.tgt.gold;
          burst(tx, b.tgt.y, '#ff8800', 14);
          showGoldPop(tx, b.tgt.y - 12, b.tgt.gold);
          updateHUD();
        }
        S.bullets.splice(i, 1);
        continue;
      }
      b.x += (dx / d) * b.spd;
      b.y += (dy / d) * b.spd;
    }
  }

  // ── particles ──
  function burst(x, y, col, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3;
      S.particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 1.8,
                         life: 1, col, r: 2 + Math.random() * 3 });
    }
  }

  function particleStep() {
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const p = S.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.045;
      if (p.life <= 0) S.particles.splice(i, 1);
    }
  }

  // ── bomb ──
  function useBomb() {
    if (S.bombs <= 0 || S.phase !== 'playing') return;
    S.bombs--;
    S.flashT = 14;
    shake(20);
    for (const e of S.enemies) {
      if (!e.alive) continue;
      e.hp -= S.bombDmg;
      burst(e.x + e.w / 2, e.y + e.h / 2, '#ff5500', 12);
      if (e.hp <= 0) {
        e.alive = false;
        S.gold += e.gold;
        burst(e.x + e.w / 2, e.y, '#ffaa00', 18);
        showGoldPop(e.x + e.w / 2, e.y - 12, e.gold);
      }
    }
    updateHUD();
    for (let i = 0; i < 55; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 10;
      S.particles.push({
        x: GAME_W * 0.5, y: gh() * 0.45,
        vx: Math.cos(a)*s, vy: Math.sin(a)*s - 5,
        life: 1, col: Math.random() < 0.5 ? '#ffcc00' : '#ff3300', r: 4 + Math.random() * 7,
      });
    }
  }

  function shake(amt) { S.shakeT = 16; S.shakeAmt = amt; }

  // ── phase ──
  function phaseCheck() {
    if (S.baseHp <= 0) { endGame(false); return; }
    const allSpawned = S.spawnQ.length > 0 && S.spawnIdx >= S.spawnQ.length;
    const allDead    = S.enemies.filter(e => e.alive).length === 0;
    if (allSpawned && allDead) endGame(true);
  }

  function endGame(win) {
    S.phase = win ? 'victory' : 'defeat';
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (S.onEnd) S.onEnd(win, S.gold, S.baseHp);

    const ov  = document.getElementById('defense-overlay');
    const ttl = document.getElementById('overlay-title');
    const msg = document.getElementById('overlay-msg');

    if (win) {
      const earned = S.gold - S.goldCheckpoint;
      ttl.textContent = '防衛成功！';
      ttl.style.color = '#aaff66';
      msg.innerHTML   = `${S.day}日目を乗り越えた！<br><span class="overlay-gold">+${earned}G 獲得　所持金 ${S.gold}G</span>`;
    } else {
      ttl.textContent = '拠点陥落...';
      ttl.style.color = '#ff4422';
      msg.innerHTML   = `${S.day}日目に力尽きた…<br><span class="overlay-gold-lost">所持金は ${S.goldCheckpoint}G に戻る</span>`;
    }
    ov.classList.remove('hidden');
  }

  // ── draw ──
  function draw() {
    if (!ctx) return;
    ctx.save();

    const sc = scale();
    ctx.scale(sc, sc);

    if (S.shakeT > 0) {
      S.shakeT--;
      const s = S.shakeAmt * S.shakeT / 16;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    drawBg();
    drawBase();
    drawAllies();
    drawEnemies();
    drawBullets();
    drawParticles();
    updateAndDrawGoldPops();

    if (S.warningTimer > 0) {
      const t = S.warningTimer--;
      const fadeIn  = Math.min(1, (130 - t) / 8);
      const fadeOut = Math.min(1, t / 18);
      const flash   = Math.abs(Math.sin(t * 0.28));
      const alpha   = fadeIn * fadeOut * flash;

      ctx.save();
      ctx.fillStyle = `rgba(160,0,0,${alpha * 0.22})`;
      ctx.fillRect(0, 0, GAME_W, gh());

      const fs = Math.floor(gh() * 0.13);
      ctx.font = `bold ${fs}px monospace`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#880000';
      ctx.lineWidth = fs * 0.18;
      ctx.strokeText('⚠ WARNING ⚠', GAME_W / 2, gh() * 0.47);
      ctx.fillStyle = '#ffcc00';
      ctx.fillText('⚠ WARNING ⚠', GAME_W / 2, gh() * 0.47);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.restore();
    }

    if (S.flashT > 0) {
      S.flashT--;
      ctx.fillStyle = `rgba(255,200,60,${S.flashT / 14 * 0.6})`;
      ctx.fillRect(0, 0, GAME_W, gh());
    }
    ctx.restore();
  }

  function drawBg() {
    const gameH = gh();

    // 日数に応じた背景画像を選択（1-10→0, 11-20→1, 21-30→2, 31+→3）
    const bgIdx = Math.min(Math.floor((S.day - 1) / 10), BG_IMGS.length - 1);
    const bgImg = BG_IMGS[bgIdx];

    if (bgImg.complete && bgImg.naturalWidth > 0) {
      // cover: アスペクト比を維持して全面を埋める
      const iw = bgImg.naturalWidth, ih = bgImg.naturalHeight;
      const worldAspect = GAME_W / gameH;
      const imgAspect   = iw / ih;
      let sx, sy, sw, sh;
      if (worldAspect > imgAspect) {
        // 横が広い → 幅に合わせて高さをクロップ
        sw = iw;
        sh = iw / worldAspect;
        sx = 0;
        sy = (ih - sh) / 2;
      } else {
        // 縦が広い → 高さに合わせて幅をクロップ
        sh = ih;
        sw = ih * worldAspect;
        sx = (iw - sw) / 2;
        sy = 0;
      }
      ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, GAME_W, gameH);
    } else {
      const sg = ctx.createLinearGradient(0, 0, 0, gameH);
      sg.addColorStop(0, '#0e0505'); sg.addColorStop(1, '#200c0c');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, GAME_W, gameH);
    }
  }

  function drawBase() {
    const gndY = gh() * GND;
    const bx   = GAME_W * BASE_R;
    const bh   = Math.min(gh() * 0.29 * 1.5, 85 * 1.5);
    const bw   = BASE_W;

    if (KABE_IMG.complete && KABE_IMG.naturalWidth > 0) {
      const drawW = bw * 2.2 * 1.3;
      const drawH = KABE_IMG.naturalHeight * (drawW / KABE_IMG.naturalWidth);
      ctx.drawImage(KABE_IMG, bx - drawW / 2 + 25, gndY - drawH + 30, drawW, drawH);
    } else {
      ctx.fillStyle = '#1e1108'; ctx.fillRect(bx - bw/2, gndY - bh, bw, bh);
    }

    const ratio = S.baseHp / S.baseHpMax;
    if (ratio < 0.6) {
      const intensity = (0.6 - ratio) * 2;
      ctx.strokeStyle = `rgba(255,80,0,${intensity})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx + 6, gndY - bh * 0.88); ctx.lineTo(bx - 7, gndY - bh * 0.5);
      ctx.lineTo(bx + 9, gndY - bh * 0.28); ctx.stroke();
    }
    if (ratio < 0.3) {
      ctx.fillStyle = `rgba(255,30,0,${(0.3 - ratio) * 0.5})`;
      ctx.fillRect(bx - bw/2, gndY - bh, bw, bh);
    }
  }

  function drawAllies() {
    // 1人目の攻撃範囲終端に赤い▼
    if (S.allies.length > 0) {
      const a0  = S.allies[0];
      const rx  = a0.x + a0.range;
      const ry  = gh() * GND - 6;
      const sz  = 10;
      ctx.fillStyle = 'rgba(255, 40, 40, 0.85)';
      ctx.beginPath();
      ctx.moveTo(rx - sz, ry - sz);
      ctx.lineTo(rx + sz, ry - sz);
      ctx.lineTo(rx,      ry);
      ctx.closePath();
      ctx.fill();
    }

    for (let i = 0; i < S.allies.length; i++) {
      const a = S.allies[i];
      // キャラクター画像セット（インデックス超えは最後のセットで代用）
      const imgSet = ALLY_IMGS[Math.min(i, ALLY_IMGS.length - 1)];
      const imgIdx = a.animSeqIdx >= 0 ? SHOOT_SEQ[a.animSeqIdx] : 0;
      const img    = imgSet[imgIdx];

      if (img.complete && img.naturalWidth > 0) {
        // 画像の縦横比を維持しつつ高さ基準でサイズ決定
        const drawH = a.h * 2.2 * 0.7 * 1.3 * 1.3;
        const drawW = img.naturalWidth * (drawH / img.naturalHeight);
        const drawX = a.x + a.w / 2 - drawW / 2 - (i === 1 ? 2 : 0);
        const drawY = a.y + a.h - drawH + 10 + (i === 1 ? 6 : 0);
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      } else {
        // 画像未ロード時のフォールバック（簡易シルエット）
        ctx.fillStyle = '#3a4a2a';
        ctx.fillRect(a.x, a.y, a.w, a.h);
      }

      // マズルフラッシュ（発砲アニメーション 2・3コマ目）
      if (a.animSeqIdx >= 1 && a.animSeqIdx <= 2) {
        const alpha = 1 - (a.animSeqIdx - 1) * 0.4;
        ctx.fillStyle = `rgba(255,220,50,${alpha * 0.85})`;
        ctx.beginPath();
        ctx.arc(a.x + a.w + 20, a.y + 12 - 50, 9 * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawEnemies() {
    for (const e of S.enemies) {
      if (!e.alive) continue;
      const bob = e.fly
        ? Math.sin(S.frame * 0.12 + e.id) * 5
        : Math.sin(S.frame * 0.1 + e.id) * 2;
      ctx.save();
      drawWalker(e, e.x, e.y + bob);
      ctx.restore();

      const bw = e.w + 4, bx = e.x - 2, by = e.y - 10 + (e.type === 'walker' || e.type === 'boss_walker' ? -60 : e.type === 'brute' ? -20 : 0);
      ctx.fillStyle = '#2a0000'; ctx.fillRect(bx, by, bw, 5);
      const pct = e.hp / e.maxHp;
      ctx.fillStyle = pct > 0.5 ? '#22bb44' : pct > 0.25 ? '#ccaa00' : '#dd2200';
      ctx.fillRect(bx, by, bw * pct, 5);
    }
  }

  function drawWalker(e, x, y) {
    const imgs = ZOMBIE_IMGS[e.type];
    const seq  = ZOMBIE_WALK_SEQ[e.type] ?? ZOMBIE_WALK_SEQ.walker;
    if (imgs) {
      const img = imgs[seq[e.spriteSeq % seq.length]];
      if (img.complete && img.naturalWidth > 0) {
        const drawH = e.h * (e.type === 'runner' ? 1.3 : e.type === 'brute' ? 1.6875 : e.type === 'flyer' ? 1.8 : e.type === 'boss_walker' ? 2.6 : 2.25);
        const drawW = img.naturalWidth * (drawH / img.naturalHeight);
        ctx.drawImage(img, x + e.w / 2 - drawW / 2, y + e.h - drawH, drawW, drawH);
        return;
      }
    }
    // フォールバック（画像未ロード時）
    ctx.fillStyle = e.col;
    ctx.fillRect(x, y, e.w, e.h);
  }

  function drawFlyer(e, x, y) {
    const flap = Math.sin(S.frame * 0.3 + e.id) * 11;
    ctx.fillStyle = shade(e.col, -12);
    ctx.beginPath();
    ctx.moveTo(x + e.w/2, y + e.h/2);
    ctx.lineTo(x - 14, y + flap); ctx.lineTo(x - 3, y + e.h * 0.72);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + e.w/2, y + e.h/2);
    ctx.lineTo(x + e.w + 14, y + flap); ctx.lineTo(x + e.w + 3, y + e.h * 0.72);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = e.col;
    ctx.beginPath();
    ctx.ellipse(x + e.w/2, y + e.h/2, e.w/2, e.h/2 * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff2200';
    ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(x + e.w/2 - 5, y + e.h/2 - 3, 3.5, 0, Math.PI * 2);
    ctx.arc(x + e.w/2 + 5, y + e.h/2 - 3, 3.5, 0, Math.PI * 2);
    ctx.fill(); ctx.shadowBlur = 0;
  }

  function drawBullets() {
    for (const b of S.bullets) {
      ctx.fillStyle = 'rgba(255,220,50,0.22)';
      ctx.beginPath(); ctx.arc(b.x - 7, b.y, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = b.col;
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,100,0.4)';
      ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI*2); ctx.fill();
    }
  }

  function drawParticles() {
    for (const p of S.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── helpers ──
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (n >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
    const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  // ── HUD ──
  function updateHUD() {
    if (!S) return;
    document.getElementById('hud-day').textContent  = `防衛 ${S.day}日目`;
    document.getElementById('hud-gold').textContent = `${S.gold}`;
    const pct = S.baseHp / S.baseHpMax * 100;
    const bar = document.getElementById('hud-hp-bar');
    bar.style.width      = pct + '%';
    bar.style.background = pct > 50 ? '#22cc44' : pct > 25 ? '#ccaa00' : '#dd2200';
    document.getElementById('hud-hp-text').textContent = `${S.baseHp} / ${S.baseHpMax}`;
    document.getElementById('bomb-count').textContent  = `×${S.bombs}`;
    document.getElementById('bomb-btn').disabled = S.bombs <= 0;
  }

  const goldPops = [];
  function showGoldPop(x, y, amount) {
    goldPops.push({ x, y, vy: -1.2, life: 1, text: `+${amount}G` });
  }

  function updateAndDrawGoldPops() {
    for (let i = goldPops.length - 1; i >= 0; i--) {
      const p = goldPops[i];
      p.y  += p.vy;
      p.life -= 0.03;
      if (p.life <= 0) { goldPops.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle   = '#ffe050';
      ctx.font        = 'bold 13px sans-serif';
      ctx.textAlign   = 'center';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign   = 'left';
  }

  // ── controls ──
  function bindControls() {
    const btn = document.getElementById('bomb-btn');
    btn.disabled = false;
    btn.onclick  = useBomb;
  }

  // ── public ──
  function updateSpeedBtn() {
    const btn = document.getElementById('speed-btn');
    btn.textContent = `${S.speed}x`;
    btn.classList.toggle('speed-active', S.speed > 1);
  }

  function toggleSpeed() {
    if (!S) return;
    const maxSpd = S.speed3Unlocked ? 3 : 2;
    S.speed = S.speed >= maxSpd ? 1 : S.speed + 1;
    updateSpeedBtn();
    saveData.speedActive = S.speed;
    Save.commit(saveData);
  }

  function stop() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      window.removeEventListener('orientationchange', resizeHandler);
      resizeHandler = null;
    }
  }

  return { start, stop, toggleSpeed };
})();
