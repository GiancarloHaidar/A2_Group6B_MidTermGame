// ============================================================
// gameScreen.js
// init, draw, and input handling for the "game" screen
// ============================================================

// ── Input state ──────────────────────────────────────────────
let _keys = { left: false, right: false, down: false };

// worldOffsetX: pixels from left edge of screen to left edge of play column.
// Recalculated each frame so it stays centred on resize automatically.
function getWorldOffsetX() {
  return (width - PLAY_WIDTH) / 2;
}

function initGame() {
  platforms = [];
  for (let p of levelData.platforms) {
    platforms.push({ x: p.x, y: p.y, w: p.w, h: p.h, color: p.color || [80, 80, 90] });
  }

  player = new Player(levelData.startX, levelData.startY);

  cam = new Camera2D();
  // Snap camera vertically to player on first frame (no lerp pop)
  cam.y = player.y + player.h / 2 - height * CAM_ANCHOR_Y;
  cam.y = constrain(cam.y, 0, max(0, LEVEL_HEIGHT - height));
}

function drawGame() {
  background(18, 20, 30);

  // ── Update ───────────────────────────────────────────────
  player.inputLeft  = _keys.left;
  player.inputRight = _keys.right;
  player.inputDown  = _keys.down;
  player.update(platforms);
  cam.update(player);

  let ox = getWorldOffsetX(); // horizontal offset to centre the play column

  // ── Full-screen background (screen space, drawn before world) ──
  drawScreenBackground();

  // ── World space: shifted right by ox, up by cam.y ────────
  push();
    translate(ox, 0);   // centre the play column horizontally
    cam.apply();        // scroll vertically

    drawColumnBackground(); // background just for the play column
    drawPlatforms();
    player.draw();

  pop();

  // ── Screen-space UI (never moves) ────────────────────────
  drawUI();
}

// Full-width dark background so side gutters look intentional
function drawScreenBackground() {
  noStroke();
  // Subtle side gutters — slightly different tone to frame the play column
  fill(12, 13, 18);
  rect(0, 0, width, height);
}

// The scrolling gradient inside the 800px play column
function drawColumnBackground() {
  noStroke();
  let strips = 10;
  let stripH = LEVEL_HEIGHT / strips;
  for (let i = 0; i < strips; i++) {
    // t = 0 at ground (bottom), t = 1 at top
    let t = 1 - (i / strips);
    let r = lerp(14, 22, t);
    let g = lerp(22, 38, t);
    let b = lerp(42, 68, t);
    fill(r, g, b);
    rect(0, i * stripH, PLAY_WIDTH, stripH);
  }

  // Subtle left/right edge vignette inside column
  for (let side = 0; side < 2; side++) {
    let x = side === 0 ? 0 : PLAY_WIDTH - 32;
    let c1 = color(8, 10, 16, 120);
    let c2 = color(8, 10, 16, 0);
    for (let i = 0; i < 32; i++) {
      let a = map(i, 0, 32, 120, 0);
      fill(8, 10, 16, a);
      noStroke();
      rect(side === 0 ? i : PLAY_WIDTH - i - 1, 0, 1, LEVEL_HEIGHT);
    }
  }
}

function drawPlatforms() {
  noStroke();
  for (let p of platforms) {
    fill(p.color[0], p.color[1], p.color[2]);
    rect(p.x, p.y, p.w, p.h, 3);
    // Subtle top highlight
    fill(255, 255, 255, 22);
    rect(p.x, p.y, p.w, 4, 3, 3, 0, 0);
  }
}

function drawUI() {
  let ox = getWorldOffsetX();

  // ── Top HUD bar ───────────────────────────────────────────
  // Spans only the play column width, centred. Ready for energy bar.
  fill(10, 12, 20, 220);
  noStroke();
  rect(ox, 0, PLAY_WIDTH, UI_TOP_RESERVE);

  // ── Altitude bar (right edge of play column) ─────────────
  let altitude = max(0, LEVEL_HEIGHT - (player.y + player.h));
  let pct      = altitude / LEVEL_HEIGHT;

  let barX    = ox + PLAY_WIDTH - 22;
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
    text("A/D or ← → move   ↑/W/Space jump   ↓/S fast-fall",
         ox + PLAY_WIDTH / 2, height - 20);
  }

  textAlign(LEFT, BASELINE);
}

// ── Input routing ────────────────────────────────────────────
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
