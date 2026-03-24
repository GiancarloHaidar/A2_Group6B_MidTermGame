// ============================================================
// gameScreen.js
// init, draw, and input handling for the "game" screen.
//
// Blur integration:
//   drawGame() renders the world into _worldBuffer, then calls
//   stampWorldBuffer() (defined in sketch.js) which sets
//   drawingContext.filter = "blur(Npx)" on the MAIN canvas before
//   calling image(), then resets it to "none" immediately after.
//   UI is drawn after the reset, so it is never blurred.
// ============================================================

// ── Input state ──────────────────────────────────────────────
let _keys = { left: false, right: false, down: false };

// ── Instructions visibility ───────────────────────────────────
// Stays false until the player presses any movement key for the first time.
let _playerHasMoved = false;

// ── Finish / win state ───────────────────────────────────────
let finishPlatform = null;
let winTriggered = false;
let winAnimTimer = 0;

// ── Altitude mapping ─────────────────────────────────────────
let _groundY = 0;
let _climbPx = 1;

// ── Ground scenery layout ─────────────────────────────────────
// All positions are in level-space (same coordinate system as platforms).
// SCENERY_GROUND_Y = top of the ground platform (y=3950 in level1.json).
// SCENERY_SINK = how many px each sprite is buried into the ground so
//   roots/base look planted rather than floating.
const SCENERY_GROUND_Y = 3950;
const SCENERY_TREE_SINK = 18; // px the tree base overlaps into the ground
const SCENERY_HOUSE_SINK = 75; // px the house base overlaps into the ground

// Tree PNG is ~1024px tall; scale 0.12 → ~123px  (≈3× player height)
const SCENERY_TREES = [];

// House PNG is ~1024px tall; scale 0.10 → ~102px  (≈2.5× player height)
const SCENERY_HOUSE = {
  x: 30,
  scale: 0.3,
};

// ── Astronaut sprite draw offsets (tune if alignment needs adjustment) ───
const PLAYER_DRAW_OFFSET_X = -10; // px left/right relative to hitbox
const PLAYER_DRAW_OFFSET_Y = -12; // px up/down relative to hitbox
const PLAYER_DRAW_W = PLAYER_W + 20; // drawn width (can be wider than hitbox)
const PLAYER_DRAW_H = PLAYER_H + 18; // drawn height (can be taller than hitbox)

// ── Cloud positions in level-space ───────────────────────────
// Scattered through the middle altitude range (y ~800–2800).
// x is within 0–PLAY_WIDTH. scale controls display size.
// Alternate between Cloud1 and Cloud2 for variety.
const CLOUD_DEFS = [
  { type: 1, x: -20, y: 3000, scale: 0.9 }, // LEFT
  { type: 1, x: 500, y: 2620, scale: 0.9 }, // RIGHT
  { type: 2, x: -15, y: 2380, scale: 0.82 }, // LEFT
  { type: 2, x: 500, y: 2150, scale: 0.85 }, // RIGHT
  { type: 1, x: -20, y: 1870, scale: 0.76 }, // LEFT
  { type: 1, x: 500, y: 1600, scale: 0.76 }, // RIGHT
  { type: 2, x: -15, y: 1420, scale: 0.7 }, // LEFT
  { type: 2, x: 615, y: 1170, scale: 0.85 }, // RIGHT
  { type: 1, x: -20, y: 920, scale: 0.65 }, // LEFT
  { type: 1, x: 605, y: 800, scale: 0.65 }, // RIGHT
];

function getWorldOffsetX() {
  return (width - PLAY_WIDTH) / 2;
}

function initGame() {
  platforms = [];
  finishPlatform = null;
  winTriggered = false;
  winAnimTimer = 0;
  _playerHasMoved = false;

  for (let p of levelData.platforms) {
    const plat = {
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      color: p.color || [80, 80, 90],
      zone: p.zone || "normal",
      section: p.section || "normal",
      laneKey: p.laneKey || "C",
      isFinish: !!p.isFinish,
      baseX: p.x,
      wobblePhase: random(TWO_PI),
    };
    platforms.push(plat);
    if (plat.isFinish) finishPlatform = plat;
  }

  player = new Player(levelData.startX, levelData.startY);

  cam = new Camera2D();
  cam.y = player.y + player.h / 2 - height * CAM_ANCHOR_Y;
  cam.y = constrain(cam.y, 0, max(0, LEVEL_HEIGHT - height));

  const groundPlat = levelData.platforms.find((p) => p.zone === "ground");
  _groundY = groundPlat ? groundPlat.y : LEVEL_HEIGHT;
  _climbPx = finishPlatform
    ? max(1, _groundY - finishPlatform.y)
    : LEVEL_HEIGHT;
}

// ── Main game draw ────────────────────────────────────────────
function drawGame() {
  // ── Logic update ────────────────────────────────────────────
  if (!winTriggered) {
    updatePlatformWobble();
    player.inputLeft = _keys.left;
    player.inputRight = _keys.right;
    player.inputDown = _keys.down;
    player.update(platforms);
    checkWin();
    checkExhaustion();
  } else {
    winAnimTimer++;
    if (winAnimTimer > 200) currentScreen = "win";
  }

  cam.update(player);

  // ── World rendering → _worldBuffer ──────────────────────────
  let g = _worldBuffer;
  let ox = getWorldOffsetX();

  g.clear();
  g.noStroke();
  g.fill(10, 20, 80);
  g.rect(0, 0, g.width, g.height);

  g.push();
  g.translate(ox, 0);
  g.translate(-cam.x, -cam.y);
  _drawColumnBackground(g);
  _drawClouds(g);
  _drawGroundScenery(g);
  _drawPlatforms(g);
  if (finishPlatform) _drawFinishMarker(g, finishPlatform);
  _drawPlayer(g);
  g.pop();

  // ── Stamp buffer onto main canvas (with blur if active) ──────
  clear();
  stampWorldBuffer();

  // ── Side panels (drawn on main canvas, outside play column) ──
  _drawSidePanels(ox);

  // ── UI → main canvas (always drawn after filter reset) ───────
  drawUI();
}

// ── Side panels matching the dark navy theme ──────────────────
function _drawSidePanels(ox) {
  noStroke();
  let camMidY = cam.y + height * 0.5;
  let t = 1 - constrain(camMidY / LEVEL_HEIGHT, 0, 1);
  let r = lerp(135, 10, t);
  let gVal = lerp(195, 20, t);
  let b = lerp(255, 80, t);
  fill(r, gVal, b);
  rect(0, 0, ox, height);
  rect(ox + PLAY_WIDTH, 0, width - ox - PLAY_WIDTH, height);
}

// ── Win detection ─────────────────────────────────────────────
function checkWin() {
  if (!finishPlatform || winTriggered) return;
  const fp = finishPlatform;
  const onTop =
    player.onGround &&
    player.x + player.w > fp.x &&
    player.x < fp.x + fp.w &&
    abs(player.y + player.h - fp.y) < 4;
  if (onTop) {
    winTriggered = true;
    if (typeof winSound !== "undefined" && winSound.isLoaded()) {
      winSound.play();
    }
    if (typeof bgMusic !== "undefined" && bgMusic.isPlaying()) {
      bgMusic.pause();
    }
  }
}

// ── Exhaustion / lose detection ───────────────────────────────
function checkExhaustion() {
  if (player.isExhausted) {
    currentScreen = "lose";
  }
}

// ── Platform wobble (Layer 3) ─────────────────────────────────
// Disabled for Level 1: platforms are static so the intro is learnable
// without the added challenge of moving surfaces. The wobble constants
// in constants.js are retained for future levels.
function updatePlatformWobble() {
  // No-op in Level 1.
}

// ── Checkpoint refill ─────────────────────────────────────────
function refillCheckpoint() {
  player.refillAtCheckpoint();
}

// ══════════════════════════════════════════════════════════════
// Private draw helpers — all accept a graphics context (g)
// ══════════════════════════════════════════════════════════════

// ── Clouds scattered through the mid-altitude sky ────────────
// Drawn after the background gradient but before platforms so they
// sit behind everything else. Uses CLOUD_DEFS array defined above.
function _drawClouds(g) {
  if (!imgCloud1 || !imgCloud2) return;
  g.noTint();
  for (let c of CLOUD_DEFS) {
    let img = c.type === 1 ? imgCloud1 : imgCloud2;
    let cw = img.width * c.scale;
    let ch = img.height * c.scale;
    g.image(img, c.x, c.y, cw, ch);
  }
}

// ── Ground scenery: trees (behind house) then house ───────────
// imgHouse and imgTree are loaded in sketch.js preload().
// Both sprites sit with their bottom edge on SCENERY_GROUND_Y.
// No collision — purely visual.
function _drawGroundScenery(g) {
  if (!imgTree || !imgHouse) return;

  // Trees first so they render behind the house.
  // Sink base into the ground so roots look planted.
  for (let t of SCENERY_TREES) {
    let tw = imgTree.width * t.scale;
    let th = imgTree.height * t.scale;
    g.image(imgTree, t.x, SCENERY_GROUND_Y - th + SCENERY_TREE_SINK, tw, th);
  }

  // House — base sunk so it sits on the ground surface.
  let hw = imgHouse.width * SCENERY_HOUSE.scale;
  let hh = imgHouse.height * SCENERY_HOUSE.scale;
  g.image(
    imgHouse,
    SCENERY_HOUSE.x,
    SCENERY_GROUND_Y - hh + SCENERY_HOUSE_SINK,
    hw,
    hh,
  );
}

function _drawFinishMarker(g, fp) {
  const cx = fp.x + fp.w / 2;
  const topY = fp.y;

  let pulse = 0.5 + 0.5 * sin(frameCount * 0.06);
  g.noStroke();
  g.fill(180, 255, 160, 30 + 40 * pulse);
  g.rect(fp.x - 6, topY - 90, fp.w + 12, 90, 4);

  g.stroke(200, 200, 200);
  g.strokeWeight(2);
  g.line(cx, topY, cx, topY - 80);
  g.noStroke();

  let wave = sin(frameCount * 0.08) * 6;
  g.fill(100, 220, 100);
  g.beginShape();
  g.vertex(cx, topY - 78);
  g.vertex(cx + 36 + wave, topY - 68 + wave * 0.3);
  g.vertex(cx + 34 + wave, topY - 58 + wave * 0.3);
  g.vertex(cx, topY - 56);
  g.endShape(CLOSE);

  g.fill(200, 255, 180, 180 + 60 * pulse);
  g.noStroke();
  g.textAlign(CENTER, BOTTOM);
  g.textSize(13);
  g.textFont("monospace");
  g.text("G O A L", cx, topY - 86);

  for (let s = 0; s < 4; s++) {
    let angle = frameCount * 0.04 + s * (PI / 2);
    let r = 28 + 4 * pulse;
    let sx = cx + cos(angle) * r;
    let sy = topY - 40 + sin(angle) * r * 0.5;
    g.fill(255, 240, 100, 200);
    g.noStroke();
    _drawStar(g, sx, sy, 4, 8, 5);
  }
  g.textAlign(LEFT, BASELINE);
}

function _drawStar(g, x, y, r1, r2, pts) {
  g.beginShape();
  for (let i = 0; i < pts * 2; i++) {
    let angle = (PI / pts) * i - PI / 2;
    let r = i % 2 === 0 ? r2 : r1;
    g.vertex(x + cos(angle) * r, y + sin(angle) * r);
  }
  g.endShape(CLOSE);
}

function _drawColumnBackground(g) {
  g.noStroke();
  let strips = 40;
  let stripH = LEVEL_HEIGHT / strips;

  for (let i = 0; i < strips; i++) {
    let t = 1 - i / strips;
    let r = lerp(135, 10, t);
    let gVal = lerp(195, 20, t);
    let b = lerp(255, 80, t);
    g.fill(r, gVal, b);
    g.rect(0, i * stripH, PLAY_WIDTH, stripH + 1);
  }

  g.stroke(255, 255, 255, 6);
  g.strokeWeight(1);
  for (let lx = 4; lx <= 22; lx += 9) g.line(lx, 0, lx, LEVEL_HEIGHT);
  for (let rx = PLAY_WIDTH - 4; rx >= PLAY_WIDTH - 22; rx -= 9)
    g.line(rx, 0, rx, LEVEL_HEIGHT);
  g.noStroke();

  for (let i = 0; i < 30; i++) {
    let a = map(i, 0, 30, 25, 0);
    g.fill(0, 10, 40, a);
    g.rect(i, 0, 1, LEVEL_HEIGHT);
    g.rect(PLAY_WIDTH - i - 1, 0, 1, LEVEL_HEIGHT);
  }

  // ── Pixel grid overlay ───────────────────────────────────
  g.stroke(0, 0, 0, 8);
  g.strokeWeight(1);
  let gridSize = 8;
  for (let x = 0; x < PLAY_WIDTH; x += gridSize) {
    g.line(x, 0, x, LEVEL_HEIGHT);
  }
  for (let y = 0; y < LEVEL_HEIGHT; y += gridSize) {
    g.line(0, y, PLAY_WIDTH, y);
  }
  g.noStroke();
}

function _drawPlatforms(g) {
  g.noStroke();

  // ── Ground platform image ──────────────────────────────────
  if (imgGround) {
    const gp = platforms.find((p) => p.zone === "ground");
    if (gp) {
      // Draw at natural image height to avoid squishing the sprite
      g.image(imgGround, gp.x, gp.y - 40, gp.w, imgGround.height);
    }
  }

  for (let p of platforms) {
    if (p.isFinish) continue;
    if (p.zone === "ground") continue; // skip — drawn as image above

    const lk = p.laneKey || "C";
    const isWall = lk === "LL" || lk === "RR";
    const isPeak = p.section === "Peak";
    const isZigzag = p.section === "Zigzag";
    const isNarrow = p.w < 155;

    // Opacity gradient: platforms near the ground start semi-transparent
    // (easy, familiar terrain), growing fully opaque as the player climbs.
    // This mirrors colour-perception fatigue — the world hardens as you tire.
    // altitudeFrac = 0 at bottom of playable zone, 1 at finish platform.
    let platAltFrac = constrain((_groundY - p.y) / _climbPx, 0, 1);
    // Map fraction → alpha: low platforms 255 (fully solid), upper ~20 (nearly invisible)
    let platAlpha = round(lerp(255, 40, platAltFrac));
    // Flatten the colour range: all platforms draw from a dark steel-blue base.
    // The JSON colours still shift slightly but we clamp them down so the hue
    // difference is subtle — opacity does the heavy lifting, not colour.
    let baseR = round(lerp(60, 85, platAltFrac));
    let baseG = round(lerp(85, 110, platAltFrac));
    let baseB = round(lerp(120, 150, platAltFrac));
    g.fill(baseR, baseG, baseB, platAlpha);
    g.rect(p.x, p.y, p.w, p.h, 3);

    let hlAlpha = map(p.w, 130, 225, 15, 50) * (platAlpha / 255);
    g.fill(255, 255, 255, constrain(hlAlpha, 12, 42));
    g.rect(p.x, p.y, p.w, 4, 3, 3, 0, 0);

    if (isWall) {
      g.noStroke();
      g.fill(255, 255, 255, 18);
      if (lk === "LL") g.rect(p.x, p.y, 3, p.h, 3, 0, 0, 3);
      else g.rect(p.x + p.w - 3, p.y, 3, p.h, 0, 3, 3, 0);
    }

    if (isPeak || (isZigzag && isNarrow)) {
      g.noFill();
      g.stroke(215, 145, 55, 50);
      g.strokeWeight(1);
      g.rect(p.x, p.y, p.w, p.h, 3);
      g.noStroke();
    }

    g.noStroke();
    g.fill(0, 0, 0, 10);
    g.rect(p.x + 2, p.y + p.h, p.w - 4, 5, 0, 0, 3, 3);
  }

  if (finishPlatform) {
    const fp = finishPlatform;
    g.fill(fp.color[0], fp.color[1], fp.color[2]);
    g.rect(fp.x, fp.y, fp.w, fp.h, 3);
    g.fill(255, 255, 255, 42);
    g.rect(fp.x, fp.y, fp.w, 4, 3, 3, 0, 0);
    g.fill(100, 210, 100, 22);
    g.rect(fp.x + 2, fp.y + fp.h, fp.w - 4, 6, 0, 0, 4, 4);
  }
}

function _drawPlayer(g) {
  let p = player;

  if (!imgAstronaut) {
    // Fallback: plain rect if image not yet loaded
    g.fill(220, 200, 160);
    g.noStroke();
    g.rect(p.x, p.y, p.w, p.h, 4);
    return;
  }

  // ── Tint based on energy state ───────────────────────────────
  if (p.isExhausted) {
    // Dark, desaturated — exhausted
    g.tint(160, 100, 100);
  } else if (p.energy < ENERGY_LOW_THRESHOLD) {
    // Warm red shift — tired
    let t = p.energy / ENERGY_LOW_THRESHOLD; // 0=exhausted threshold, 1=normal threshold
    let r = 255;
    let gv = round(lerp(100, 230, t));
    let b = round(lerp(80, 200, t));
    g.tint(r, gv, b);
  } else {
    // Normal — no tint
    g.noTint();
  }

  // ── Draw with horizontal flip for facing direction ───────────
  let dw = PLAYER_DRAW_W;
  let dh = PLAYER_DRAW_H;
  let dx = p.x + PLAYER_DRAW_OFFSET_X;
  let dy = p.y + PLAYER_DRAW_OFFSET_Y;

  if (!p.facingRight) {
    g.image(imgAstronaut, dx, dy, dw, dh);
  } else {
    // Flip horizontally: translate to right edge, scale x by -1
    g.push();
    g.translate(dx + dw, dy);
    g.scale(-1, 1);
    g.image(imgAstronaut, 0, 0, dw, dh);
    g.pop();
  }

  // Always clear tint after drawing so other images aren't affected
  g.noTint();
}

// ── UI (drawn on main canvas after filter reset — never blurred) ──
function drawUI() {
  let ox = getWorldOffsetX();

  fill(10, 20, 80, 245);
  noStroke();
  rect(ox, 0, PLAY_WIDTH, UI_TOP_RESERVE);

  fill(100, 160, 255, 80);
  rect(ox, UI_TOP_RESERVE - 1, PLAY_WIDTH, 1);

  let eFrac = constrain(player.energy / ENERGY_MAX, 0, 1);

  let labelW = 54;
  let pctW = 36;
  let padX = 12;
  let barH = 12;
  let barTopY = 10;
  let trackX = ox + padX + labelW;
  let trackW = PLAY_WIDTH - padX * 2 - labelW - pctW;

  fill(180, 200, 255, 220);
  noStroke();
  textFont("monospace");
  textSize(10);
  textAlign(LEFT, CENTER);
  text("ENERGY", ox + padX, barTopY + barH / 2);

  fill(5, 10, 40);
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

  let pulseAlpha =
    eFrac < ENERGY_LOW_THRESHOLD / ENERGY_MAX
      ? round(180 + 75 * sin(frameCount * 0.22))
      : 255;

  let fillW = trackW * eFrac;
  if (fillW > 4) {
    fill(eR, eG, eB, pulseAlpha);
    noStroke();
    rect(trackX, barTopY, fillW, barH, 4);
  }

  noFill();
  stroke(80, 120, 200, 180);
  strokeWeight(1);
  rect(trackX, barTopY, trackW, barH, 4);
  noStroke();

  fill(eR, eG, eB, 220);
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
  let altKm = constrain(((_groundY - playerFeetY) / _climbPx) * 100, 0, 100);

  let altitude = max(0, LEVEL_HEIGHT - (player.y + player.h));
  let zoneName = getZoneLabel(altitude);

  fill(200, 220, 255, 220);
  noStroke();
  textAlign(RIGHT, CENTER);
  textSize(9);
  text(zoneName.toUpperCase(), ox + PLAY_WIDTH - padX, UI_TOP_RESERVE / 2 + 6);

  let barX = ox + PLAY_WIDTH - 22;
  let barTopYA = UI_TOP_RESERVE + height * 0.04;
  let barHA = height * 0.55;

  // Outer glow / shadow panel — wider and more opaque for visibility
  fill(0, 0, 0, 140);
  noStroke();
  rect(barX - 7, barTopYA - 6, 22, barHA + 12, 8);

  // Border ring — bright so it pops against any background colour
  stroke(200, 230, 255, 200);
  strokeWeight(1.5);
  noFill();
  rect(barX - 2, barTopYA - 2, 12, barHA + 4, 5);
  noStroke();

  // Dark track
  fill(8, 14, 40, 230);
  noStroke();
  rect(barX, barTopYA, 8, barHA, 4);

  let altFrac = altKm / 100;
  // Colour: warm orange at ground → bright cyan/white near summit
  let aR = round(lerp(255, 180, altFrac));
  let aG = round(lerp(140, 240, altFrac));
  let aB = round(lerp(40, 255, altFrac));

  // Soft glow behind the fill strip
  fill(aR, aG, aB, 40);
  rect(barX - 1, barTopYA, 10, barHA, 4);

  // Main fill
  fill(aR, aG, aB, 240);
  let fillH = barHA * altFrac;
  if (fillH > 2) rect(barX, barTopYA + barHA - fillH, 8, fillH, 4);

  // Top tick line
  stroke(255, 255, 255, 180);
  strokeWeight(1);
  line(barX - 3, barTopYA, barX + 11, barTopYA);
  noStroke();

  // Progress marker dot — pulses gently
  if (fillH > 2) {
    let dotPulse = 0.65 + 0.35 * sin(frameCount * 0.08);
    fill(255, 255, 255, round(200 * dotPulse));
    noStroke();
    ellipse(barX + 4, barTopYA + barHA - fillH, 7, 7);
    fill(aR, aG, aB, 255);
    ellipse(barX + 4, barTopYA + barHA - fillH, 4, 4);
  }

  let kmLabel = altKm >= 99.5 ? "100 km" : floor(altKm) + " km";
  textAlign(RIGHT, BOTTOM);
  textSize(11);
  textFont("monospace");

  // Label background — dark pill
  fill(0, 0, 0, 200);
  noStroke();
  rect(barX - 32, barTopYA - 19, 46, 16, 3);

  fill(aR, aG, aB, 255);
  text(kmLabel, barX + 8, barTopYA - 3);

  if (winTriggered) {
    let a = map(winAnimTimer, 0, 90, 0, 200);
    fill(160, 210, 255, constrain(a, 0, 200));
    noStroke();
    rect(ox, 0, PLAY_WIDTH, height);
    fill(10, 40, 100, constrain(a * 1.5, 0, 255));
    textAlign(CENTER, CENTER);
    textSize(36);
    textFont("monospace");
    text("YOU MADE IT!", ox + PLAY_WIDTH / 2, height / 2);
    textAlign(LEFT, BASELINE);
  }

  if (!_playerHasMoved && !winTriggered) {
    fill(20, 20, 60, 200);
    textAlign(CENTER, BOTTOM);
    textStyle(BOLD);
    textSize(13);
    text(
      "A/D or ← → move   ↑/W/Space jump   ↓/S fast-fall",
      ox + PLAY_WIDTH / 2,
      height - 20,
    );
  }

  textAlign(LEFT, BASELINE);
}

function getZoneLabel(altitude) {
  const t = altitude / LEVEL_HEIGHT;
  if (t < 0.08) return "Ground";
  if (t < 0.2) return "Left Wall";
  if (t < 0.3) return "Bridge";
  if (t < 0.42) return "Right Wall";
  if (t < 0.52) return "Bridge";
  if (t < 0.62) return "L↔C Zigzag";
  if (t < 0.72) return "R↔C Zigzag";
  if (t < 0.8) return "Left Ledge";
  if (t < 0.86) return "Crossing";
  if (t < 0.92) return "Right Ledge";
  if (t < 0.96) return "Crossing";
  if (t < 0.99) return "Peak";
  return "SUMMIT";
}

// ── Input routing ─────────────────────────────────────────────
function gameKeyPressed(kc) {
  if (kc === LEFT_ARROW || kc === 65) {
    _keys.left = true;
    _playerHasMoved = true;
  }
  if (kc === RIGHT_ARROW || kc === 68) {
    _keys.right = true;
    _playerHasMoved = true;
  }
  if (kc === DOWN_ARROW || kc === 83) {
    _keys.down = true;
    _playerHasMoved = true;
  }
  if (kc === UP_ARROW || kc === 87 || kc === 32) {
    player.inputJump = true;
    _playerHasMoved = true;
  }
}

function gameKeyReleased(kc) {
  if (kc === LEFT_ARROW || kc === 65) _keys.left = false;
  if (kc === RIGHT_ARROW || kc === 68) _keys.right = false;
  if (kc === DOWN_ARROW || kc === 83) _keys.down = false;
}
