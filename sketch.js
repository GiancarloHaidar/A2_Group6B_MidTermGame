// ============================================================
// sketch.js — Conductor / Router
// ============================================================

let currentScreen = "game"; // "game" | "win" | "lose"

let player;
let platforms;
let cam;
let levelData;

// ── World graphics buffer ─────────────────────────────────────
// The game world is drawn into this offscreen buffer each frame.
// When a blur event is active, the main canvas's drawingContext.filter
// is set to "blur(Npx)" immediately before stamping the buffer onto
// the main canvas with image(). After the stamp, the filter is reset
// to "none" so the UI drawn on top is never blurred.
//
// WHY NOT CSS filter on the buffer element:
//   p5's image() reads raw pixel data from the buffer canvas — it does
//   not composite the DOM element, so a CSS filter on _worldBuffer.elt
//   has zero visual effect when drawn via image(). The drawingContext
//   filter property works because it affects the actual 2D draw call.
let _worldBuffer = null;

// ── Blur state machine ────────────────────────────────────────
// States: "idle" | "fadein" | "hold" | "fadeout"
// _blurTimer        : frames remaining in the current state
// _blurRadius       : the blur value (px) to apply this frame (0 = clear)
// _nextBlurInterval : idle duration queued for after the current event ends
let _blurState = "idle";
let _blurTimer = 0;
let _blurRadius = 0;
let _nextBlurInterval = 0;

let imgHouse;
let imgTree;
let imgAstronaut;
let imgGround;

function preload() {
  levelData = loadJSON("level1.json");
  imgHouse = loadImage("Assets/house.png");
  imgTree = loadImage("Assets/tree.png");
  imgAstronaut = loadImage("Assets/astronaut.png");
  imgGround = loadImage("Assets/ground.png");
}

function _initBlur() {
  _blurState = "idle";
  _blurTimer = BLUR_INTERVAL_MAX; // start with a long pause before first event
  _blurRadius = 0;
  _nextBlurInterval = 0;
}

// Compute the idle interval for the next event based on current fatigue.
// At low fatigue (high energy) → long gap (BLUR_INTERVAL_MAX).
// At high fatigue (low energy) → short gap (BLUR_INTERVAL_MIN).
function _nextIdleInterval() {
  if (!player) return BLUR_INTERVAL_MAX;
  let fatigueT = 1 - constrain(player.energy / ENERGY_MAX, 0, 1);
  // lerp: fatigueT=0 → MAX, fatigueT=1 → MIN
  let interval = lerp(BLUR_INTERVAL_MAX, BLUR_INTERVAL_MIN, fatigueT);
  // Add a small random spread so events don't feel mechanical
  return floor(interval + random(-20, 20));
}

// Peak blur radius for the current event, scaled by fatigue.
// At full energy: BLUR_INTENSITY_MAX.
// At zero energy: BLUR_INTENSITY_MAX × (1 + BLUR_ENERGY_SCALE).
function _peakBlur() {
  if (!player) return BLUR_INTENSITY_MAX;
  let fatigueT = 1 - constrain(player.energy / ENERGY_MAX, 0, 1);
  return BLUR_INTENSITY_MAX * (1 + BLUR_ENERGY_SCALE * fatigueT);
}

// Advance the state machine one frame and update _blurRadius.
// Blur only fires while energy is below ENERGY_MAX (i.e. once the
// player has spent any energy at all). At full energy the idle
// countdown is frozen so no event can be queued.
function _updateBlur() {
  let gameActive = currentScreen === "game";
  let energyDepleting = player && player.energy < ENERGY_MAX;

  switch (_blurState) {
    case "idle":
      _blurRadius = 0;
      // Only count down when the game is active AND energy has started draining.
      if (gameActive && energyDepleting) {
        _blurTimer--;
        if (_blurTimer <= 0) {
          _blurState = "fadein";
          _blurTimer = BLUR_FADE_IN_FRAMES;
          // Pre-compute how long the idle gap after this event will be,
          // using current fatigue so it reflects the player's state now.
          _nextBlurInterval = _nextIdleInterval();
        }
      }
      break;

    case "fadein":
      _blurTimer--;
      let tIn = 1 - _blurTimer / BLUR_FADE_IN_FRAMES; // 0→1
      _blurRadius = _peakBlur() * tIn;
      if (_blurTimer <= 0) {
        _blurState = "hold";
        _blurTimer = BLUR_HOLD_FRAMES;
      }
      break;

    case "hold":
      _blurRadius = _peakBlur();
      _blurTimer--;
      if (_blurTimer <= 0) {
        _blurState = "fadeout";
        _blurTimer = BLUR_FADE_OUT_FRAMES;
      }
      break;

    case "fadeout":
      _blurTimer--;
      let tOut = _blurTimer / BLUR_FADE_OUT_FRAMES; // 1→0
      _blurRadius = _peakBlur() * tOut;
      if (_blurTimer <= 0) {
        _blurRadius = 0;
        _blurState = "idle";
        // Use the interval that was computed when this event started.
        _blurTimer =
          _nextBlurInterval > 0 ? _nextBlurInterval : _nextIdleInterval();
      }
      break;
  }
}

// Apply _blurRadius to the main canvas drawingContext right before
// stamping the world buffer, then clear it immediately after.
// This is called from drawGame() in gameScreen.js.
function stampWorldBuffer() {
  let ctx = drawingContext; // main canvas 2D context

  if (_blurRadius > 0.05) {
    ctx.filter = "blur(" + _blurRadius.toFixed(2) + "px)";
  }

  image(_worldBuffer, 0, 0);

  // Always reset — ensures UI draw calls that follow are never blurred.
  ctx.filter = "none";
}

// ── p5 lifecycle ──────────────────────────────────────────────

function setup() {
  createCanvas(windowWidth, windowHeight);
  _worldBuffer = createGraphics(windowWidth, windowHeight);
  initGame();
  _initBlur();
}

function draw() {
  _updateBlur();

  switch (currentScreen) {
    case "game":
      drawGame();
      break;
    case "win":
      drawWinScreen();
      break;
    case "lose":
      drawLoseScreen();
      break;
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
    let sx = ox + random(PLAY_WIDTH);
    let sy = random(height);
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
  text("Congrats!", ox + PLAY_WIDTH / 2, height / 2 - 60 + bounce);

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

// ── Lose screen ───────────────────────────────────────────────
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
    let ex = ox + random(PLAY_WIDTH);
    let ey = random(height);
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
    let r = i % 2 === 0 ? r2 : r1;
    vertex(x + cos(angle) * r, y + sin(angle) * r);
  }
  endShape(CLOSE);
}

function keyPressed() {
  if (currentScreen === "game") {
    gameKeyPressed(keyCode);
  }
  if (
    (currentScreen === "win" || currentScreen === "lose") &&
    (key === "r" || key === "R")
  ) {
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
  if (_worldBuffer) {
    _worldBuffer.resizeCanvas(windowWidth, windowHeight);
  }
}
