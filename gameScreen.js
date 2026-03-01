// ============================================================
// gameScreen.js
// init, draw, and input handling for the "game" screen
// ============================================================

// ── Input state ────────────────────────────────────────────
let _keys = { left: false, right: false };

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
  // ── Altitude indicator ────────────────────────────────
  let altitude = max(0, LEVEL_HEIGHT - (player.y + player.h));
  let maxAlt   = LEVEL_HEIGHT;
  let pct      = altitude / maxAlt;

  // Altitude bar (right side)
  let barX = width - 28;
  let barH = height * 0.6;
  let barY = height * 0.2;

  fill(255, 255, 255, 15);
  rect(barX, barY, 8, barH, 4);

  fill(140, 210, 255, 180);
  let fillH = barH * pct;
  rect(barX, barY + barH - fillH, 8, fillH, 4);

  // Altitude text
  fill(180, 220, 255, 200);
  noStroke();
  textAlign(RIGHT, TOP);
  textSize(11);
  textFont("monospace");
  text(nf(floor(altitude), 1) + "m", barX - 4, barY);

  // ── Controls hint (fade after 5 sec) ─────────────────
  if (millis() < 5000) {
    let alpha = map(millis(), 3000, 5000, 200, 0);
    alpha = constrain(alpha, 0, 200);
    fill(255, 255, 255, alpha);
    textAlign(CENTER, BOTTOM);
    textSize(13);
    text("A / D or ← → to move   SPACE to jump", width / 2, height - 20);
  }

  textAlign(LEFT, BASELINE); // reset
}

// ── Input routing ────────────────────────────────────────────
function gameKeyPressed(kc) {
  if (kc === LEFT_ARROW  || kc === 65) _keys.left  = true;
  if (kc === RIGHT_ARROW || kc === 68) _keys.right = true;
  if (kc === 32) player.inputJump = true; // SPACE
}

function gameKeyReleased(kc) {
  if (kc === LEFT_ARROW  || kc === 65) _keys.left  = false;
  if (kc === RIGHT_ARROW || kc === 68) _keys.right = false;
}
