// ============================================================
// gameScreen.js
// init, draw, and input handling for the "game" screen
// ============================================================

// ── Input state ────────────────────────────────────────────
let _keys = { left: false, right: false, down: false };

function initGame() {
  // Build platform list from JSON (loaded in preload)
  platforms = [];
  for (let p of levelData.platforms) {
    platforms.push({ x: p.x, y: p.y, w: p.w, h: p.h, color: p.color || [80, 80, 90] });
  }

  // Spawn player at JSON start position
  player = new Player(levelData.startX, levelData.startY);

  cam = new Camera2D();
  // Snap camera to player immediately (no lerp on first frame)
  cam.x = player.x + player.w / 2 - width  / 2;
  cam.y = player.y + player.h / 2 - height * CAM_ANCHOR_Y;
  cam.x = constrain(cam.x, 0, max(0, LEVEL_WIDTH  - width));
  cam.y = constrain(cam.y, 0, max(0, LEVEL_HEIGHT - height));
}

function drawGame() {
  background(18, 20, 30);

  // ── Update ──────────────────────────────────────────────
  player.inputLeft  = _keys.left;
  player.inputRight = _keys.right;
  player.inputDown  = _keys.down;
  player.update(platforms);
  cam.update(player);

  // ── World space ─────────────────────────────────────────
  push();
  cam.apply();

  drawWorldBackground();
  drawPlatforms();
  player.draw();

  pop();

  // ── Screen space UI ─────────────────────────────────────
  drawUI();
}

function drawWorldBackground() {
  // Subtle altitude gradient strips (purely visual, world space)
  noStroke();
  let strips = 8;
  let stripH = LEVEL_HEIGHT / strips;
  for (let i = 0; i < strips; i++) {
    let t = i / strips; // 0 = ground, 1 = top
    let r = lerp(18, 10, t);
    let g = lerp(20, 30, t);
    let b = lerp(30, 55, t);
    fill(r, g, b);
    rect(0, i * stripH, LEVEL_WIDTH, stripH);
  }
}

function drawPlatforms() {
  noStroke();
  for (let p of platforms) {
    fill(p.color[0], p.color[1], p.color[2]);
    rect(p.x, p.y, p.w, p.h, 3);

    // Subtle top highlight
    fill(255, 255, 255, 18);
    rect(p.x, p.y, p.w, 4, 3, 3, 0, 0);
  }
}

function drawUI() {
  // ── Top bar (reserved for future energy bar) ──────────────
  // Draw a subtle dark strip so it reads as a HUD zone.
  // When you add the energy bar, draw it inside y=0..UI_TOP_RESERVE.
  fill(10, 12, 20, 210);
  noStroke();
  rect(0, 0, width, UI_TOP_RESERVE);

  // ── Altitude indicator (right side, below top bar) ────────
  let altitude = max(0, LEVEL_HEIGHT - (player.y + player.h));
  let pct      = altitude / LEVEL_HEIGHT;

  let barX    = width - 28;
  let barTopY = UI_TOP_RESERVE + height * 0.04;
  let barH    = height * 0.55;

  fill(255, 255, 255, 15);
  rect(barX, barTopY, 8, barH, 4);

  fill(140, 210, 255, 180);
  let fillH = barH * pct;
  rect(barX, barTopY + barH - fillH, 8, fillH, 4);

  fill(180, 220, 255, 200);
  noStroke();
  textAlign(RIGHT, TOP);
  textSize(11);
  textFont("monospace");
  text(floor(altitude) + "m", barX - 4, barTopY);

  // ── Controls hint (fades after 5 sec) ────────────────────
  if (millis() < 5000) {
    let alpha = map(millis(), 3000, 5000, 200, 0);
    alpha = constrain(alpha, 0, 200);
    fill(255, 255, 255, alpha);
    textAlign(CENTER, BOTTOM);
    textSize(13);
    text("A/D or ← → move   ↑/W/Space jump   ↓/S fast-fall", width / 2, height - 20);
  }

  textAlign(LEFT, BASELINE); // reset
}

// ── Input routing ────────────────────────────────────────────
function gameKeyPressed(kc) {
  if (kc === LEFT_ARROW  || kc === 65) _keys.left  = true;  // ← or A
  if (kc === RIGHT_ARROW || kc === 68) _keys.right = true;  // → or D
  if (kc === DOWN_ARROW  || kc === 83) _keys.down  = true;  // ↓ or S
  if (kc === UP_ARROW    || kc === 87 || kc === 32)         // ↑ or W or SPACE
    player.inputJump = true;
}

function gameKeyReleased(kc) {
  if (kc === LEFT_ARROW  || kc === 65) _keys.left  = false;
  if (kc === RIGHT_ARROW || kc === 68) _keys.right = false;
  if (kc === DOWN_ARROW  || kc === 83) _keys.down  = false;
}
