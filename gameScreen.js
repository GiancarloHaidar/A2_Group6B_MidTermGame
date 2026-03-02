// ============================================================
// gameScreen.js
// init, draw, and input handling for the "game" screen
// ============================================================

// ── Input state ──────────────────────────────────────────────
let _keys = { left: false, right: false, down: false };

// ── Finish / win state ───────────────────────────────────────
let finishPlatform = null;
let winTriggered   = false;
let winAnimTimer   = 0;

// ── Altitude mapping ─────────────────────────────────────────
let _groundY  = 0;
let _climbPx  = 1;

function getWorldOffsetX() {
  return (width - PLAY_WIDTH) / 2;
}

function initGame() {
  platforms      = [];
  finishPlatform = null;
  winTriggered   = false;
  winAnimTimer   = 0;

  for (let p of levelData.platforms) {
    const plat = {
      x:       p.x,
      y:       p.y,
      w:       p.w,
      h:       p.h,
      color:   p.color   || [80, 80, 90],
      zone:    p.zone    || 'normal',
      section: p.section || 'normal',
      laneKey: p.laneKey || 'C',
      isFinish: !!p.isFinish,
      // ── Platform wobble (Layer 3) ────────────────────────
      // baseX is the authoritative JSON x; p.x is mutated each frame.
      // wobblePhase is randomised so platforms don't swing in unison.
      baseX:       p.x,
      wobblePhase: random(TWO_PI),
    };
    platforms.push(plat);
    if (plat.isFinish) finishPlatform = plat;
  }

  player = new Player(levelData.startX, levelData.startY);

  cam   = new Camera2D();
  cam.y = player.y + player.h / 2 - height * CAM_ANCHOR_Y;
  cam.y = constrain(cam.y, 0, max(0, LEVEL_HEIGHT - height));

  const groundPlat = levelData.platforms.find(p => p.zone === 'ground');
  _groundY = groundPlat ? groundPlat.y : LEVEL_HEIGHT;
  _climbPx = finishPlatform
    ? max(1, _groundY - finishPlatform.y)
    : LEVEL_HEIGHT;
}

function drawGame() {
  background(18, 20, 30);

  if (!winTriggered) {
    // Layer 3: advance platform wobble BEFORE player.update() so
    // AABB collision sees the correct updated p.x this frame.
    updatePlatformWobble();
    player.inputLeft  = _keys.left;
    player.inputRight = _keys.right;
    player.inputDown  = _keys.down;
    player.update(platforms);
    checkWin();
    checkExhaustion();
  } else {
    winAnimTimer++;
    if (winAnimTimer > 90) currentScreen = "win";
  }

  cam.update(player);

  let ox = getWorldOffsetX();

  drawScreenBackground();

  push();
    translate(ox, 0);
    cam.apply();
    drawColumnBackground();
    drawPlatforms();
    if (finishPlatform) drawFinishMarker(finishPlatform);
    player.draw();
  pop();

  drawUI();
}

// ── Win detection ─────────────────────────────────────────────
function checkWin() {
  if (!finishPlatform || winTriggered) return;
  const fp    = finishPlatform;
  const onTop = player.onGround &&
                player.x + player.w > fp.x &&
                player.x < fp.x + fp.w &&
                abs(player.y + player.h - fp.y) < 4;
  if (onTop) winTriggered = true;
}

// ── Exhaustion / lose detection ───────────────────────────────
function checkExhaustion() {
  if (player.isExhausted) {
    currentScreen = "lose";
  }
}

// ── Layer 3: Platform wobble ──────────────────────────────────
// Called once per frame before player.update().
// Mutates p.x to its current oscillated position.
// Amplitude = PLAT_WOBBLE_AMP_MAX × altitude_t²
//   altitude_t = 1 − (p.baseY / LEVEL_HEIGHT)  [0 at ground, 1 at top]
// Square exponent: nearly zero in the lower half, significant near the summit.
// Ground slab and finish platform are always exempt from wobble.
function updatePlatformWobble() {
  for (let p of platforms) {
    if (p.isFinish || p.zone === 'ground') continue;

    // altitude_t: 0 at bottom of level, 1 at top.
    let altitude_t = constrain(1 - (p.y / LEVEL_HEIGHT), 0, 1);

    // Square curve keeps lower platforms stable.
    let amp = PLAT_WOBBLE_AMP_MAX * altitude_t * altitude_t;

    // Skip negligible amplitudes (saves sin() on low platforms).
    if (amp < 0.1) continue;

    p.wobblePhase += PLAT_WOBBLE_FREQ;
    p.x = p.baseX + sin(p.wobblePhase) * amp;
  }
}

// ── Checkpoint refill ─────────────────────────────────────────
function refillCheckpoint() {
  player.refillAtCheckpoint();
}

// ── Finish marker ─────────────────────────────────────────────
function drawFinishMarker(fp) {
  const cx   = fp.x + fp.w / 2;
  const topY = fp.y;

  let pulse = 0.5 + 0.5 * sin(frameCount * 0.06);
  noStroke();
  fill(180, 255, 160, 30 + 40 * pulse);
  rect(fp.x - 6, topY - 90, fp.w + 12, 90, 4);

  stroke(200, 200, 200);
  strokeWeight(2);
  line(cx, topY, cx, topY - 80);
  noStroke();

  let wave = sin(frameCount * 0.08) * 6;
  fill(100, 220, 100);
  beginShape();
    vertex(cx,             topY - 78);
    vertex(cx + 36 + wave, topY - 68 + wave * 0.3);
    vertex(cx + 34 + wave, topY - 58 + wave * 0.3);
    vertex(cx,             topY - 56);
  endShape(CLOSE);

  fill(200, 255, 180, 180 + 60 * pulse);
  noStroke();
  textAlign(CENTER, BOTTOM);
  textSize(13);
  textFont("monospace");
  text("G O A L", cx, topY - 86);

  for (let s = 0; s < 4; s++) {
    let angle = frameCount * 0.04 + s * (PI / 2);
    let r     = 28 + 4 * pulse;
    let sx    = cx + cos(angle) * r;
    let sy    = topY - 40 + sin(angle) * r * 0.5;
    fill(255, 240, 100, 200);
    noStroke();
    drawStar(sx, sy, 4, 8, 5);
  }
  textAlign(LEFT, BASELINE);
}

function drawStar(x, y, r1, r2, pts) {
  beginShape();
  for (let i = 0; i < pts * 2; i++) {
    let angle = (PI / pts) * i - PI / 2;
    let r = (i % 2 === 0) ? r2 : r1;
    vertex(x + cos(angle) * r, y + sin(angle) * r);
  }
  endShape(CLOSE);
}

// ── Backgrounds ───────────────────────────────────────────────
function drawScreenBackground() {
  noStroke();
  fill(10, 11, 16);
  rect(0, 0, width, height);
}

function drawColumnBackground() {
  noStroke();
  let strips = 20;
  let stripH = LEVEL_HEIGHT / strips;
  for (let i = 0; i < strips; i++) {
    let t = 1 - (i / strips);
    fill(lerp(12, 20, t), lerp(18, 36, t), lerp(35, 62, t));
    rect(0, i * stripH, PLAY_WIDTH, stripH);
  }
  stroke(255, 255, 255, 6);
  strokeWeight(1);
  for (let lx = 4; lx <= 22; lx += 9) line(lx, 0, lx, LEVEL_HEIGHT);
  for (let rx = PLAY_WIDTH - 4; rx >= PLAY_WIDTH - 22; rx -= 9) line(rx, 0, rx, LEVEL_HEIGHT);
  noStroke();
  for (let i = 0; i < 50; i++) {
    let a = map(i, 0, 50, 160, 0);
    fill(8, 10, 16, a);
    rect(i, 0, 1, LEVEL_HEIGHT);
    rect(PLAY_WIDTH - i - 1, 0, 1, LEVEL_HEIGHT);
  }
}

// ── Platforms ─────────────────────────────────────────────────
function drawPlatforms() {
  noStroke();
  for (let p of platforms) {
    if (p.isFinish) continue;

    const lk       = p.laneKey || 'C';
    const isWall   = (lk === 'LL' || lk === 'RR');
    const isPeak   = (p.section === 'Peak');
    const isZigzag = (p.section === 'Zigzag');
    const isNarrow = (p.w < 155);

    fill(p.color[0], p.color[1], p.color[2]);
    rect(p.x, p.y, p.w, p.h, 3);

    let hlAlpha = map(p.w, 130, 225, 12, 42);
    fill(255, 255, 255, constrain(hlAlpha, 12, 42));
    rect(p.x, p.y, p.w, 4, 3, 3, 0, 0);

    if (isWall) {
      noStroke();
      fill(255, 255, 255, 18);
      if (lk === 'LL') rect(p.x,           p.y, 3, p.h, 3, 0, 0, 3);
      else             rect(p.x + p.w - 3, p.y, 3, p.h, 0, 3, 3, 0);
    }

    if (isPeak || (isZigzag && isNarrow)) {
      noFill();
      stroke(215, 145, 55, 50);
      strokeWeight(1);
      rect(p.x, p.y, p.w, p.h, 3);
      noStroke();
    }

    noStroke();
    fill(0, 0, 0, 32);
    rect(p.x + 2, p.y + p.h, p.w - 4, 5, 0, 0, 3, 3);
  }

  if (finishPlatform) {
    const fp = finishPlatform;
    fill(fp.color[0], fp.color[1], fp.color[2]);
    rect(fp.x, fp.y, fp.w, fp.h, 3);
    fill(255, 255, 255, 42);
    rect(fp.x, fp.y, fp.w, 4, 3, 3, 0, 0);
    fill(100, 210, 100, 22);
    rect(fp.x + 2, fp.y + fp.h, fp.w - 4, 6, 0, 0, 4, 4);
  }
}

// ── UI ────────────────────────────────────────────────────────
function drawUI() {
  let ox = getWorldOffsetX();

  fill(10, 12, 20, 230);
  noStroke();
  rect(ox, 0, PLAY_WIDTH, UI_TOP_RESERVE);

  let eFrac = constrain(player.energy / ENERGY_MAX, 0, 1);

  let labelW  = 54;
  let pctW    = 36;
  let padX    = 12;
  let barH    = 12;
  let barTopY = 10;
  let trackX  = ox + padX + labelW;
  let trackW  = PLAY_WIDTH - padX * 2 - labelW - pctW;

  fill(160, 170, 195, 190);
  noStroke();
  textFont("monospace");
  textSize(10);
  textAlign(LEFT, CENTER);
  text("ENERGY", ox + padX, barTopY + barH / 2);

  fill(25, 30, 45);
  noStroke();
  rect(trackX, barTopY, trackW, barH, 4);

  let eR, eG, eB;
  if (eFrac >= 0.5) {
    eR = round(lerp(55, 230, 1 - (eFrac - 0.5) * 2));
    eG = 215;
    eB = 55;
  } else {
    eR = 230;
    eG = round(lerp(55, 215, eFrac * 2));
    eB = 55;
  }

  let pulseAlpha = (eFrac < ENERGY_LOW_THRESHOLD / ENERGY_MAX)
    ? round(180 + 75 * sin(frameCount * 0.22))
    : 255;

  let fillW = trackW * eFrac;
  if (fillW > 4) {
    fill(eR, eG, eB, pulseAlpha);
    noStroke();
    rect(trackX, barTopY, fillW, barH, 4);
  }

  noFill();
  stroke(70, 80, 105, 200);
  strokeWeight(1);
  rect(trackX, barTopY, trackW, barH, 4);
  noStroke();

  fill(eR, eG, eB, 200);
  textAlign(LEFT, CENTER);
  textSize(10);
  text(floor(eFrac * 100) + "%", trackX + trackW + 5, barTopY + barH / 2);

  if (eFrac < ENERGY_LOW_THRESHOLD / ENERGY_MAX && !player.isExhausted) {
    let wa = round(120 + 110 * sin(frameCount * 0.25));
    fill(255, 75, 75, wa);
    noStroke();
    textAlign(CENTER, TOP);
    textSize(10);
    text("! LOW ENERGY !", ox + PLAY_WIDTH / 2, barTopY + barH + 5);
  }

  let playerFeetY = player.y + PLAYER_H;
  let altKm       = constrain((_groundY - playerFeetY) / _climbPx * 100, 0, 100);

  let altitude = max(0, LEVEL_HEIGHT - (player.y + player.h));
  let zoneName = getZoneLabel(altitude);
  fill(140, 155, 182, 140);
  noStroke();
  textAlign(RIGHT, CENTER);
  textSize(9);
  text(zoneName.toUpperCase(), ox + PLAY_WIDTH - padX, UI_TOP_RESERVE / 2 + 6);

  let barX     = ox + PLAY_WIDTH - 22;
  let barTopYA = UI_TOP_RESERVE + height * 0.04;
  let barHA    = height * 0.55;

  fill(255, 255, 255, 15);
  noStroke();
  rect(barX, barTopYA, 8, barHA, 4);

  let altFrac = altKm / 100;
  let aR = round(lerp(80,  220, altFrac));
  let aG = round(lerp(140, 240, altFrac));
  let aB = 255;
  fill(aR, aG, aB, 180);
  let fillH = barHA * altFrac;
  if (fillH > 2) rect(barX, barTopYA + barHA - fillH, 8, fillH, 4);

  stroke(200, 230, 255, 80);
  strokeWeight(1);
  line(barX - 3, barTopYA, barX + 11, barTopYA);
  noStroke();

  fill(aR, aG, aB, 200);
  textAlign(RIGHT, BOTTOM);
  textSize(11);
  textFont("monospace");
  let kmLabel = altKm >= 99.5 ? "100 km" : floor(altKm) + " km";
  text(kmLabel, barX + 8, barTopYA - 2);

  if (winTriggered) {
    let a = map(winAnimTimer, 0, 90, 0, 200);
    fill(180, 255, 160, constrain(a, 0, 200));
    noStroke();
    rect(ox, 0, PLAY_WIDTH, height);
    fill(30, 80, 30, constrain(a * 1.5, 0, 255));
    textAlign(CENTER, CENTER);
    textSize(36);
    textFont("monospace");
    text("YOU MADE IT!", ox + PLAY_WIDTH / 2, height / 2);
    textAlign(LEFT, BASELINE);
  }

  if (millis() < 5000 && !winTriggered) {
    let alpha = map(millis(), 3000, 5000, 200, 0);
    alpha = constrain(alpha, 0, 200);
    fill(255, 255, 255, alpha);
    textAlign(CENTER, BOTTOM);
    textSize(13);
    text("A/D or ← → move   ↑/W/Space jump   ↓/S fast-fall",
         ox + PLAY_WIDTH / 2, height - 20);
  }

  textAlign(LEFT, BASELINE);
}

function getZoneLabel(altitude) {
  const t = altitude / LEVEL_HEIGHT;
  if (t < 0.08) return "Ground";
  if (t < 0.20) return "Left Wall";
  if (t < 0.30) return "Bridge";
  if (t < 0.42) return "Right Wall";
  if (t < 0.52) return "Bridge";
  if (t < 0.62) return "L↔C Zigzag";
  if (t < 0.72) return "R↔C Zigzag";
  if (t < 0.80) return "Left Ledge";
  if (t < 0.86) return "Crossing";
  if (t < 0.92) return "Right Ledge";
  if (t < 0.96) return "Crossing";
  if (t < 0.99) return "Peak";
  return "SUMMIT";
}

// ── Input routing ─────────────────────────────────────────────
function gameKeyPressed(kc) {
  if (kc === LEFT_ARROW  || kc === 65) _keys.left  = true;
  if (kc === RIGHT_ARROW || kc === 68) _keys.right = true;
  if (kc === DOWN_ARROW  || kc === 83) _keys.down  = true;
  if (kc === UP_ARROW    || kc === 87 || kc === 32)
    player.inputJump = true;
}

function gameKeyReleased(kc) {
  if (kc === LEFT_ARROW  || kc === 65) _keys.left  = false;
  if (kc === RIGHT_ARROW || kc === 68) _keys.right = false;
  if (kc === DOWN_ARROW  || kc === 83) _keys.down  = false;
}
