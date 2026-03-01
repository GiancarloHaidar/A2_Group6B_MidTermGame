// ============================================================
// gameScreen.js
// init, draw, and input handling for the "game" screen
// ============================================================

// ── Input state ──────────────────────────────────────────────
let _keys = { left: false, right: false, down: false };

// ── Finish / win state ───────────────────────────────────────
let finishPlatform = null;   // reference to the finish platform object
let winTriggered   = false;
let winAnimTimer   = 0;      // counts up in frames after win

// worldOffsetX: pixels from screen left to play column left.
// Recalculated each frame — always centred on resize.
function getWorldOffsetX() {
  return (width - PLAY_WIDTH) / 2;
}

function initGame() {
  platforms    = [];
  finishPlatform = null;
  winTriggered = false;
  winAnimTimer = 0;

  for (let p of levelData.platforms) {
    const plat = { x: p.x, y: p.y, w: p.w, h: p.h,
                   color: p.color || [80,80,90],
                   zone: p.zone || 'normal',
                   isFinish: !!p.isFinish };
    platforms.push(plat);
    if (plat.isFinish) finishPlatform = plat;
  }

  player = new Player(levelData.startX, levelData.startY);

  cam = new Camera2D();
  cam.y = player.y + player.h / 2 - height * CAM_ANCHOR_Y;
  cam.y = constrain(cam.y, 0, max(0, LEVEL_HEIGHT - height));
}

function drawGame() {
  background(18, 20, 30);

  // ── Update ────────────────────────────────────────────────
  if (!winTriggered) {
    player.inputLeft  = _keys.left;
    player.inputRight = _keys.right;
    player.inputDown  = _keys.down;
    player.update(platforms);
    checkWin();
  } else {
    winAnimTimer++;
    // After 90 frames (1.5s) switch to win screen
    if (winAnimTimer > 90) currentScreen = "win";
  }

  cam.update(player);

  let ox = getWorldOffsetX();

  // ── Screen-space full background ──────────────────────────
  drawScreenBackground();

  // ── World space ───────────────────────────────────────────
  push();
    translate(ox, 0);
    cam.apply();
    drawColumnBackground();
    drawPlatforms();
    if (finishPlatform) drawFinishMarker(finishPlatform);
    player.draw();
  pop();

  // ── Screen-space UI ───────────────────────────────────────
  drawUI();
}

// ── Win detection ─────────────────────────────────────────────
function checkWin() {
  if (!finishPlatform || winTriggered) return;
  // Player is standing on the finish platform
  const fp = finishPlatform;
  const onTop = player.onGround &&
                player.x + player.w > fp.x &&
                player.x < fp.x + fp.w &&
                abs(player.y + player.h - fp.y) < 4;
  if (onTop) winTriggered = true;
}

// ── Finish marker (drawn in world space) ─────────────────────
function drawFinishMarker(fp) {
  const cx  = fp.x + fp.w / 2;
  const topY = fp.y;

  // Pulsing glow under the flag
  let pulse = 0.5 + 0.5 * sin(frameCount * 0.06);
  noStroke();
  fill(180, 255, 160, 30 + 40 * pulse);
  rect(fp.x - 6, topY - 90, fp.w + 12, 90, 4);

  // Flag pole
  stroke(200, 200, 200);
  strokeWeight(2);
  line(cx, topY, cx, topY - 80);
  noStroke();

  // Waving flag
  let wave = sin(frameCount * 0.08) * 6;
  fill(100, 220, 100);
  // Simple trapezoid flag that "waves"
  beginShape();
    vertex(cx,      topY - 78);
    vertex(cx + 36 + wave, topY - 68 + wave * 0.3);
    vertex(cx + 34 + wave, topY - 58 + wave * 0.3);
    vertex(cx,      topY - 56);
  endShape(CLOSE);

  // "GOAL" text above flag
  fill(200, 255, 180, 180 + 60 * pulse);
  noStroke();
  textAlign(CENTER, BOTTOM);
  textSize(13);
  textFont("monospace");
  text("G O A L", cx, topY - 86);

  // Star particles orbiting
  for (let s = 0; s < 4; s++) {
    let angle = frameCount * 0.04 + s * (PI / 2);
    let r = 28 + 4 * pulse;
    let sx = cx + cos(angle) * r;
    let sy = topY - 40 + sin(angle) * r * 0.5;
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
  let strips = 12;
  let stripH = LEVEL_HEIGHT / strips;
  for (let i = 0; i < strips; i++) {
    let t = 1 - (i / strips); // 1 = top, 0 = bottom
    let r = lerp(14, 24, t);
    let g = lerp(22, 42, t);
    let b = lerp(42, 72, t);
    fill(r, g, b);
    rect(0, i * stripH, PLAY_WIDTH, stripH);
  }
  // Side vignette
  for (let i = 0; i < 28; i++) {
    let a = map(i, 0, 28, 100, 0);
    fill(8, 10, 16, a);
    noStroke();
    rect(i, 0, 1, LEVEL_HEIGHT);
    rect(PLAY_WIDTH - i - 1, 0, 1, LEVEL_HEIGHT);
  }
}

// ── Platforms ─────────────────────────────────────────────────
function drawPlatforms() {
  noStroke();
  for (let p of platforms) {
    if (p.isFinish) continue; // drawn separately with marker

    // Zone-based color tinting already baked into p.color
    fill(p.color[0], p.color[1], p.color[2]);
    rect(p.x, p.y, p.w, p.h, 3);

    // Top highlight — brighter on wide (easy) platforms
    let hlAlpha = map(p.w, 80, 300, 12, 32);
    fill(255, 255, 255, hlAlpha);
    rect(p.x, p.y, p.w, 4, 3, 3, 0, 0);

    // Narrow platform (zone D) gets a subtle orange warning tint on edge
    if (p.zone === 'D') {
      stroke(200, 130, 60, 60);
      strokeWeight(1);
      noFill();
      rect(p.x, p.y, p.w, p.h, 3);
      noStroke();
    }
  }

  // Finish platform — draw with green glow
  if (finishPlatform) {
    const fp = finishPlatform;
    fill(fp.color[0], fp.color[1], fp.color[2]);
    rect(fp.x, fp.y, fp.w, fp.h, 3);
    fill(255, 255, 255, 40);
    rect(fp.x, fp.y, fp.w, 4, 3, 3, 0, 0);
  }
}

// ── UI ────────────────────────────────────────────────────────
function drawUI() {
  let ox = getWorldOffsetX();

  // Top HUD bar (reserved for energy bar — energy bar goes here in next step)
  fill(10, 12, 20, 220);
  noStroke();
  rect(ox, 0, PLAY_WIDTH, UI_TOP_RESERVE);

  // ── Zone label (top-left of HUD) ──────────────────────────
  // Tells player which difficulty zone they're in
  let altitude = max(0, LEVEL_HEIGHT - (player.y + player.h));
  let zoneName  = getZoneLabel(altitude);
  fill(180, 190, 210, 160);
  noStroke();
  textAlign(LEFT, CENTER);
  textSize(11);
  textFont("monospace");
  text("ZONE " + zoneName, ox + 14, UI_TOP_RESERVE / 2);

  // ── Altitude bar (right edge of play column) ──────────────
  let pct      = altitude / LEVEL_HEIGHT;
  let barX     = ox + PLAY_WIDTH - 22;
  let barTopY  = UI_TOP_RESERVE + height * 0.04;
  let barH     = height * 0.55;

  fill(255, 255, 255, 15);
  rect(barX, barTopY, 8, barH, 4);

  fill(140, 210, 255, 180);
  let fillH = barH * pct;
  rect(barX, barTopY + barH - fillH, 8, fillH, 4);

  fill(180, 220, 255, 200);
  noStroke();
  textAlign(RIGHT, TOP);
  textSize(11);
  text(floor(altitude) + "m", barX - 4, barTopY);

  // ── Win flash overlay ──────────────────────────────────────
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

  // ── Controls hint ─────────────────────────────────────────
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
  // altitude 0 = ground, LEVEL_HEIGHT = top
  let t = altitude / LEVEL_HEIGHT;
  if (t < 0.20) return "A · Ground";
  if (t < 0.42) return "B · Rising";
  if (t < 0.66) return "C · High";
  if (t < 0.88) return "D · Peak";
  return "SUMMIT";
}

// ── Input routing ──────────────────────────────────────────────
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
