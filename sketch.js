// ============================================================
// sketch.js — Conductor / Router
// ============================================================

let currentScreen = "game"; // "game" | "win" | "lose"

let player;
let platforms;
let cam;
let levelData;

// ── World graphics buffer ─────────────────────────────────────
// The game world (background, platforms, player) is drawn onto this
// offscreen buffer instead of the main canvas. The CSS blur filter is
// applied to the buffer's own canvas element, so the UI drawn on top
// of the main canvas afterward is never affected.
let _worldBuffer = null;

// ── Blur state machine ────────────────────────────────────────
// States: "idle" | "fadein" | "hold" | "fadeout"
// _blurTimer counts down frames remaining in the current state.
// _blurAmount is the current CSS blur radius in px (0 = clear).
let _blurState  = "idle";
let _blurTimer  = 0;       // frames left in current state
let _blurAmount = 0;       // current blur radius applied to buffer (px)

// Initialise the idle countdown once constants are available.
// Called at the bottom of setup() after initGame().
function _initBlur() {
  _blurState  = "idle";
  _blurTimer  = floor(random(BLUR_INTERVAL_MIN, BLUR_INTERVAL_MAX));
  _blurAmount = 0;
  _setWorldBlur(0);
}

// ── Blur helpers ──────────────────────────────────────────────

// Apply a CSS blur filter to the buffer's underlying canvas element.
// Passing 0 removes the filter entirely so there is no residual cost.
function _setWorldBlur(radiusPx) {
  if (!_worldBuffer) return;
  let el = _worldBuffer.elt;
  if (radiusPx <= 0.05) {
    el.style.filter = "none";
  } else {
    el.style.filter = "blur(" + radiusPx.toFixed(2) + "px)";
  }
}

// Returns the peak blur for this event, scaled by current fatigue.
// fatigueT = 1 − energyFraction: 0 when fresh, 1 when exhausted.
function _peakBlur() {
  if (!player) return BLUR_INTENSITY_MAX;
  let fatigueT = 1 - constrain(player.energy / ENERGY_MAX, 0, 1);
  return BLUR_INTENSITY_MAX * (1 + BLUR_ENERGY_SCALE * fatigueT);
}

// Advance the blur state machine one frame. Called every draw() during
// the game screen. Also safe to call on win/lose screens (stays idle).
function _updateBlur() {
  // Only trigger new blur events during active gameplay.
  let gameActive = (currentScreen === "game");

  switch (_blurState) {

    case "idle":
      _blurAmount = 0;
      _setWorldBlur(0);
      if (gameActive) {
        _blurTimer--;
        if (_blurTimer <= 0) {
          // Start a new blur event.
          _blurState = "fadein";
          _blurTimer = BLUR_FADE_IN_FRAMES;
        }
      }
      break;

    case "fadein":
      // t goes 0→1 over FADE_IN_FRAMES
      _blurTimer--;
      let tIn   = 1 - (_blurTimer / BLUR_FADE_IN_FRAMES);
      _blurAmount = _peakBlur() * tIn;
      _setWorldBlur(_blurAmount);
      if (_blurTimer <= 0) {
        _blurState = "hold";
        _blurTimer = BLUR_HOLD_FRAMES;
      }
      break;

    case "hold":
      _blurAmount = _peakBlur();
      _setWorldBlur(_blurAmount);
      _blurTimer--;
      if (_blurTimer <= 0) {
        _blurState = "fadeout";
        _blurTimer = BLUR_FADE_OUT_FRAMES;
      }
      break;

    case "fadeout":
      // t goes 1→0 over FADE_OUT_FRAMES
      _blurTimer--;
      let tOut  = _blurTimer / BLUR_FADE_OUT_FRAMES;
      _blurAmount = _peakBlur() * tOut;
      _setWorldBlur(_blurAmount);
      if (_blurTimer <= 0) {
        _blurAmount = 0;
        _setWorldBlur(0);
        _blurState = "idle";
        // Schedule the next event with a fresh random interval.
        _blurTimer = floor(random(BLUR_INTERVAL_MIN, BLUR_INTERVAL_MAX));
      }
      break;
  }
}

// ── p5 lifecycle ──────────────────────────────────────────────

function preload() {
  levelData = loadJSON("level1.json");
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Create the world buffer at the same size as the canvas.
  // It is resized in windowResized() to stay in sync.
  _worldBuffer = createGraphics(windowWidth, windowHeight);

  initGame();
  _initBlur();
}

function draw() {
  // Advance the blur timer every frame regardless of screen.
  _updateBlur();

  switch (currentScreen) {
    case "game": drawGame();       break;
    case "win":  drawWinScreen();  break;
    case "lose": drawLoseScreen(); break;
  }
}

// ── Win screen ────────────────────────────────────────────────
function drawWinScreen() {
  let ox = (width - PLAY_WIDTH) / 2;
  background(10, 11, 16);

  fill(10, 11, 16);
  noStroke();
  rect(0, 0, width, height);

  for (let i = 0; i < 8; i++) {
    let t = i / 8;
    fill(lerp(20, 10, t), lerp(60, 30, t), lerp(20, 15, t));
    rect(ox, (i * height) / 8, PLAY_WIDTH, height / 8);
  }

  randomSeed(99);
  for (let i = 0; i < 40; i++) {
    let sx    = ox + random(PLAY_WIDTH);
    let sy    = random(height);
    let pulse = 0.5 + 0.5 * sin(frameCount * 0.05 + i);
    fill(255, 240, 120, 80 + 120 * pulse);
    noStroke();
    drawWinStar(sx, sy, 3, 7, 5);
  }

  let bounce = sin(frameCount * 0.05) * 8;
  fill(160, 255, 140);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(48);
  textFont("monospace");
  text("SUMMIT!", ox + PLAY_WIDTH / 2, height / 2 - 60 + bounce);

  textSize(18);
  fill(200, 255, 180);
  text("You reached the top.", ox + PLAY_WIDTH / 2, height / 2 + 10);

  let blink = frameCount % 50 < 30;
  if (blink) {
    textSize(14);
    fill(160, 200, 160);
    text("Press R to climb again", ox + PLAY_WIDTH / 2, height / 2 + 70);
  }
  textAlign(LEFT, BASELINE);
}

// ── Lose screen (exhaustion) ──────────────────────────────────
function drawLoseScreen() {
  let ox = (width - PLAY_WIDTH) / 2;
  background(8, 6, 6);

  for (let i = 0; i < 8; i++) {
    let t = i / 8;
    fill(lerp(30, 10, t), lerp(8, 4, t), lerp(8, 4, t));
    rect(ox, (i * height) / 8, PLAY_WIDTH, height / 8);
  }

  randomSeed(77);
  for (let i = 0; i < 28; i++) {
    let ex    = ox + random(PLAY_WIDTH);
    let ey    = random(height);
    let pulse = 0.4 + 0.6 * sin(frameCount * 0.09 + i * 1.4);
    fill(255, round(70 + 60 * pulse), 15, round(80 + 120 * pulse));
    noStroke();
    ellipse(ex, ey, 5 * pulse, 5 * pulse);
  }

  let bounce = sin(frameCount * 0.04) * 6;
  fill(240, 70, 60);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(44);
  textFont("monospace");
  text("EXHAUSTED", ox + PLAY_WIDTH / 2, height / 2 - 55 + bounce);

  textSize(16);
  fill(210, 130, 120);
  text("You ran out of energy.", ox + PLAY_WIDTH / 2, height / 2 + 8);

  let blink = frameCount % 50 < 30;
  if (blink) {
    textSize(13);
    fill(180, 110, 105);
    text("Press R to try again", ox + PLAY_WIDTH / 2, height / 2 + 65);
  }
  textAlign(LEFT, BASELINE);
}

function drawWinStar(x, y, r1, r2, pts) {
  beginShape();
  for (let i = 0; i < pts * 2; i++) {
    let angle = (PI / pts) * i - PI / 2;
    let r     = i % 2 === 0 ? r2 : r1;
    vertex(x + cos(angle) * r, y + sin(angle) * r);
  }
  endShape(CLOSE);
}

function keyPressed() {
  if (currentScreen === "game") {
    gameKeyPressed(keyCode);
  }
  if ((currentScreen === "win" || currentScreen === "lose") &&
      (key === "r" || key === "R")) {
    currentScreen = "game";
    initGame();
    _initBlur();
  }
}

function keyReleased() {
  if (currentScreen === "game") {
    gameKeyReleased(keyCode);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Resize the world buffer to match. Resizing clears it, which is fine
  // since it is fully redrawn every frame.
  if (_worldBuffer) {
    _worldBuffer.resizeCanvas(windowWidth, windowHeight);
  }
}
