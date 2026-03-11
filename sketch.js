// ============================================================
// sketch.js — Conductor / Router
// ============================================================

let currentScreen = "intro"; // "intro" | "game" | "win" | "lose"  ← ADDED "intro"

let player;
let platforms;
let cam;
let levelData;

// ── Intro video ───────────────────────────────────────────────
// We grab the <video> element already declared in index.html.
// Using the native DOM element is the simplest approach — no
// p5 createVideo() needed, no extra preload step.
let _introVideo = null;

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
let lowEnergySound;
let fallingSound;
let failSound;
let winSound;

function preload() {
  levelData = loadJSON("level1.json");
  bgMusic = loadSound("Assets/Background1.mp3");
  jumpSound = loadSound("Assets/Jump.mp3");
  landingSound = loadSound("Assets/Landing.mp3");
  lowEnergySound = loadSound("Assets/LowEnergy.mp3");
  fallingSound = loadSound("Assets/Falling.mp3");
  failSound = loadSound("Assets/Fail.mp3");
  winSound = loadSound("Assets/Win.mp3");
}

// ── Intro video helpers ───────────────────────────────────────

function _startIntro() {
  // Guard: don't start twice (the overlay script may call this too)
  if (window._introStarted) return;
  window._introStarted = true;

  const overlay = document.getElementById("startOverlay");

  // If the overlay is still visible, wait for the user's click first.
  // That click hides the overlay AND provides the browser gesture needed
  // for audio playback. Once clicked, we kick off the video.
  if (overlay && overlay.style.display !== "none") {
    overlay.addEventListener("click", _playIntroVideo, { once: true });
  } else {
    // Overlay already dismissed (or not present) — play immediately.
    _playIntroVideo();
  }
}

function _playIntroVideo() {
  _introVideo = document.getElementById("introVideo");

  _introVideo.src = "Assets/intro.mp4";
  _introVideo.style.display = "block";
  _introVideo.style.position = "fixed";
  _introVideo.style.top = "0";
  _introVideo.style.left = "0";
  _introVideo.style.width = "100%";
  _introVideo.style.height = "100%";
  _introVideo.style.objectFit = "cover";
  _introVideo.style.zIndex = "10";

  // Mute the video — bgMusic handles all audio
  _introVideo.muted = true;

  _introVideo.addEventListener("ended", _onIntroEnded, { once: true });

  _introVideo.play().catch(() => {
    console.warn("Intro video play() failed — skipping to game.");
    _onIntroEnded();
  });

  // Start the background music now so it plays under the intro
  // and continues uninterrupted into gameplay
  if (bgMusic && !bgMusic.isPlaying()) bgMusic.loop();
}

function _onIntroEnded() {
  // Video has finished — pause on the last frame (already there, just be explicit)
  if (_introVideo) _introVideo.pause();

  // Show the "CLICK TO CONTINUE" button
  const btn = document.getElementById("continueBtn");
  btn.style.display = "flex";
  btn.addEventListener("click", _onContinueClicked, { once: true });
}

function _onContinueClicked() {
  // Hide the button and the frozen video, then start the game
  document.getElementById("continueBtn").style.display = "none";
  if (_introVideo) {
    _introVideo.style.display = "none";
    _introVideo = null;
  }
  currentScreen = "game";
}

// ── Blur helpers (unchanged) ──────────────────────────────────

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

  bgMusic.setVolume(0.4);
  jumpSound.setVolume(0.6);
  landingSound.setVolume(0.5);
  lowEnergySound.setVolume(0.6);
  fallingSound.setVolume(0.5);
  failSound.setVolume(0.6);
  winSound.setVolume(0.6);

  imgHouse = loadImage("Assets/house.png");
  imgTree = loadImage("Assets/tree.png");
  imgAstronaut = loadImage("Assets/astronaut.png");
  imgGround = loadImage("Assets/ground.png");
  imgCloud1 = loadImage("Assets/Cloud1.png");
  imgCloud2 = loadImage("Assets/Cloud2.png");

  // ── Start the intro video right away ─────────────────────────
  _startIntro();
}

function draw() {
  // While the intro is playing the video element sits on top of
  // the canvas (z-index 10). We just clear to black so nothing
  // bleeds through underneath.
  if (currentScreen === "intro") {
    background(0);
    return; // skip all game drawing until the video ends
  }

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
  // Block ALL input while the intro screen / "click to start" overlay is active.
  if (currentScreen === "intro") return;

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
    bgMusic.loop();
  }
}

function keyReleased() {
  // Also block key-release events during intro so no "held key" state leaks
  // into the game when the screen transitions.
  if (currentScreen === "intro") return;

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
