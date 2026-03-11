// ============================================================
// sketch.js — Conductor / Router
// ============================================================

let currentScreen = "game"; // "game" | "win" | "lose"

let player;
let platforms;
let cam;
let levelData;

// ── World graphics buffer ─────────────────────────────────────
let _worldBuffer = null;

// ── Blur state machine ────────────────────────────────────────
let _blurState = "idle";
let _blurTimer = 0;
let _blurRadius = 0;
let _nextBlurInterval = 0;

let imgHouse;
let imgTree;
let imgAstronaut;
let imgGround;
let imgCloud1;
let imgCloud2;

let bgMusic;
let jumpSound;
let landingSound;

function preload() {
  // Only JSON here — p5 waits for this before starting
  levelData = loadJSON("level1.json");
  bgMusic = loadSound("Assets/Background1.mp3");
  jumpSound = loadSound("Assets/Jump.mp3");
  landingSound = loadSound("Assets/Landing.mp3");
}

function _initBlur() {
  _blurState = "idle";
  _blurTimer = BLUR_INTERVAL_MAX;
  _blurRadius = 0;
  _nextBlurInterval = 0;
}

function _nextIdleInterval() {
  if (!player) return BLUR_INTERVAL_MAX;
  let fatigueT = 1 - constrain(player.energy / ENERGY_MAX, 0, 1);
  let interval = lerp(BLUR_INTERVAL_MAX, BLUR_INTERVAL_MIN, fatigueT);
  return floor(interval + random(-20, 20));
}

function _peakBlur() {
  if (!player) return BLUR_INTENSITY_MAX;
  let fatigueT = 1 - constrain(player.energy / ENERGY_MAX, 0, 1);
  return BLUR_INTENSITY_MAX * (1 + BLUR_ENERGY_SCALE * fatigueT);
}

function _updateBlur() {
  let gameActive = currentScreen === "game";
  let energyDepleting = player && player.energy <= 70;

  switch (_blurState) {
    case "idle":
      _blurRadius = 0;
      if (gameActive && energyDepleting) {
        let targetInterval = _nextIdleInterval();
        if (_blurTimer > targetInterval) _blurTimer = targetInterval;
        _blurTimer--;
        if (_blurTimer <= 0) {
          _blurState = "fadein";
          _blurTimer = BLUR_FADE_IN_FRAMES;
          _nextBlurInterval = _nextIdleInterval();
        }
      }
      break;
    case "fadein":
      _blurTimer--;
      let tIn = 1 - _blurTimer / BLUR_FADE_IN_FRAMES;
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
      let tOut = _blurTimer / BLUR_FADE_OUT_FRAMES;
      _blurRadius = _peakBlur() * tOut;
      if (_blurTimer <= 0) {
        _blurRadius = 0;
        _blurState = "idle";
        _blurTimer =
          _nextBlurInterval > 0 ? _nextBlurInterval : _nextIdleInterval();
      }
      break;
  }
}

function stampWorldBuffer() {
  let ctx = drawingContext;
  if (_blurRadius > 0.05) {
    ctx.filter = "blur(" + _blurRadius.toFixed(2) + "px)";
  }
  image(_worldBuffer, 0, 0);
  ctx.filter = "none";
}

// ── p5 lifecycle ──────────────────────────────────────────────

function setup() {
  createCanvas(windowWidth, windowHeight);
  _worldBuffer = createGraphics(windowWidth, windowHeight);
  initGame();
  _initBlur();

  bgMusic.setVolume(0.4); // 0.0 (silent) to 1.0 (full)
  // Note: bgMusic.loop() is NOT called here to avoid browser autoplay block.
  // Music starts on the first keypress instead (see keyPressed below).
  jumpSound.setVolume(0.6);
  landingSound.setVolume(0.5);

  // Images loaded here — a missing file won't block the game from starting
  imgHouse = loadImage("Assets/house.png");
  imgTree = loadImage("Assets/tree.png");
  imgAstronaut = loadImage("Assets/astronaut.png");
  imgGround = loadImage("Assets/ground.png");
  imgCloud1 = loadImage("Assets/Cloud1.png");
  imgCloud2 = loadImage("Assets/Cloud2.png");
}

function draw() {
  _updateBlur();

  switch (currentScreen) {
    case "game":
      drawGame();
      break;
    case "win":
      if (bgMusic.isPlaying()) bgMusic.pause();
      drawWinScreen();
      break;
    case "lose":
      if (bgMusic.isPlaying()) bgMusic.pause();
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
    fill(lerp(10, 5, t), lerp(30, 15, t), lerp(60, 35, t));
    rect(ox, (i * height) / 8, PLAY_WIDTH, height / 8);
  }

  randomSeed(99);
  for (let i = 0; i < 40; i++) {
    let sx = ox + random(PLAY_WIDTH);
    let sy = random(height);
    let pulse = 0.5 + 0.5 * sin(frameCount * 0.05 + i);
    fill(120, 220, 255, 80 + 120 * pulse);
    noStroke();
    drawWinStar(sx, sy, 3, 7, 5);
  }

  let bounce = sin(frameCount * 0.05) * 8;
  fill(100, 200, 255);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(48);
  textFont("monospace");
  text("Congrats!", ox + PLAY_WIDTH / 2, height / 2 - 60 + bounce);
  textSize(18);
  fill(180, 230, 255);
  text("You reached the top.", ox + PLAY_WIDTH / 2, height / 2 + 10);
  let blink = frameCount % 50 < 30;
  if (blink) {
    textSize(14);
    fill(140, 190, 240);
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
    fill(lerp(35, 15, t), lerp(15, 6, t), lerp(4, 2, t));
    rect(ox, (i * height) / 8, PLAY_WIDTH, height / 8);
  }

  randomSeed(77);
  for (let i = 0; i < 28; i++) {
    let ex = ox + random(PLAY_WIDTH);
    let ey = random(height);
    let pulse = 0.4 + 0.6 * sin(frameCount * 0.09 + i * 1.4);
    fill(255, round(150 + 60 * pulse), 20, round(80 + 120 * pulse));
    noStroke();
    ellipse(ex, ey, 5 * pulse, 5 * pulse);
  }

  let bounce = sin(frameCount * 0.04) * 6;
  fill(255, 160, 20);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(44);
  textFont("monospace");
  text("EXHAUSTED", ox + PLAY_WIDTH / 2, height / 2 - 55 + bounce);
  textSize(16);
  fill(230, 180, 100);
  text("You ran out of energy.", ox + PLAY_WIDTH / 2, height / 2 + 8);
  let blink = frameCount % 50 < 30;
  if (blink) {
    textSize(13);
    fill(200, 160, 80);
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
  // Start music on first keypress (avoids browser autoplay block)
  if (bgMusic && !bgMusic.isPlaying()) bgMusic.loop();

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
    bgMusic.loop(); // resume music on restart
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
