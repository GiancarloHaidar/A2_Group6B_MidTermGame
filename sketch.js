// ============================================================
// sketch.js — Conductor / Router
// ============================================================

let currentScreen = "intro"; // "intro" | "game" | "win" | "lose"

let player;
let platforms;
let cam;
let levelData;

// ── Star progression ──────────────────────────────────────────
let _totalStars = 0; // cumulative stars earned this session
let _starAwardedThisWin = false; // guard: award only once per win screen visit
let _starAnimTimer = 0; // counts up when win screen opens (drives pop-in)
const STAR_ANIM_DURATION = 40; // frames for the pop-in scale animation

// ── Intro video ───────────────────────────────────────────────
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
let speakingSound;

function preload() {
  levelData = loadJSON("level1.json");
  bgMusic = loadSound("Assets/Background1.mp3");
  jumpSound = loadSound("Assets/Jump.mp3");
  landingSound = loadSound("Assets/Landing.mp3");
  lowEnergySound = loadSound("Assets/LowEnergy.mp3");
  fallingSound = loadSound("Assets/Falling.mp3");
  failSound = loadSound("Assets/Fail.mp3");
  winSound = loadSound("Assets/Win.mp3");
  speakingSound = loadSound("Assets/Speaking.mp3");
}

// ── Intro video helpers ───────────────────────────────────────

function _startIntro() {
  if (window._introStarted) return;
  window._introStarted = true;

  const overlay = document.getElementById("startOverlay");

  if (overlay && overlay.style.display !== "none") {
    overlay.addEventListener("click", _playIntroVideo, { once: true });
  } else {
    _playIntroVideo();
  }
}

function _playIntroVideo() {
  _introVideo = document.getElementById("introVideo");

  _introVideo.src = "Assets/intro.mp4";
  _introVideo.style.display = "block";
  _introVideo.style.position = "fixed";
  _introVideo.style.top = "50%";
  _introVideo.style.left = "50%";
  _introVideo.style.transform = "translate(-50%, -50%)";
  _introVideo.style.width = "90%";
  _introVideo.style.height = "90%";
  _introVideo.style.objectFit = "contain";
  _introVideo.style.zIndex = "10";

  _introVideo.muted = true;

  const EARLY_BY_INTRO = 2.0;
  let _btnShown = false;

  _introVideo.addEventListener("timeupdate", function _checkEarlyIntro() {
    if (_btnShown) return;
    const remaining = _introVideo.duration - _introVideo.currentTime;
    if (remaining <= EARLY_BY_INTRO) {
      _btnShown = true;
      _introVideo.removeEventListener("timeupdate", _checkEarlyIntro);
      _onIntroEnded();
    }
  });

  _introVideo.addEventListener("ended", _onIntroEnded, { once: true });

  _introVideo.play().catch(() => {
    console.warn("Intro video play() failed — skipping to game.");
    _onIntroEnded();
  });

  if (bgMusic && !bgMusic.isPlaying()) bgMusic.loop();
}

function _onIntroEnded() {
  if (_introVideo) _introVideo.pause();

  document.getElementById("continueBtnImg").src = "Assets/Continue.png";
  const btn = document.getElementById("continueBtn");
  btn.style.display = "flex";
  btn.addEventListener("click", _onContinueClicked, { once: true });
}

function _onContinueClicked() {
  document.getElementById("continueBtn").style.display = "none";

  if (_introVideo) {
    _introVideo.style.display = "none";
    _introVideo = null;
  }

  _playScene2();
}

// ── Scene 2 video ─────────────────────────────────────────────

function _playScene2() {
  _introVideo = document.getElementById("introVideo");

  _introVideo.src = "Assets/Scene2.mp4";
  _introVideo.muted = true;

  _introVideo.style.display = "block";
  _introVideo.style.position = "fixed";
  _introVideo.style.width = "90%";
  _introVideo.style.height = "90%";
  _introVideo.style.top = "50%";
  _introVideo.style.left = "50%";
  _introVideo.style.transform = "translate(-50%, -50%)";
  _introVideo.style.objectFit = "contain";

  const EARLY_BY = 6.0;
  let _btnShown = false;

  _introVideo.addEventListener("timeupdate", function _checkEarly() {
    if (_btnShown) return;
    const remaining = _introVideo.duration - _introVideo.currentTime;
    if (remaining <= EARLY_BY) {
      _btnShown = true;
      _introVideo.removeEventListener("timeupdate", _checkEarly);
      _onScene2Ended();
    }
  });

  _introVideo.addEventListener("ended", _onScene2Ended, { once: true });

  _introVideo.play().catch(() => {
    console.warn("Scene2 play() failed — skipping to game.");
    _onScene2Ended();
  });

  // Play the speaking sound effect when Scene 2 begins
  if (speakingSound && speakingSound.isLoaded()) speakingSound.play();
}

function _onScene2Ended() {
  if (_introVideo) _introVideo.pause();

  document.getElementById("continueBtnImg").src = "Assets/StartButton.png";
  const btn = document.getElementById("continueBtn");
  btn.style.display = "flex";
  btn.addEventListener("click", _onScene2Continued, { once: true });
}

function _onScene2Continued() {
  document.getElementById("continueBtn").style.display = "none";
  if (_introVideo) {
    _introVideo.style.display = "none";
    _introVideo = null;
  }
  currentScreen = "game";
}

// ── Blur helpers ──────────────────────────────────────────────

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

  _startIntro();
}

function draw() {
  if (currentScreen === "intro") {
    background(135, 195, 255);
    return;
  }

  _updateBlur();

  switch (currentScreen) {
    case "game":
      drawGame();
      break;
    case "win":
      if (bgMusic.isPlaying()) bgMusic.pause();
      // Award the star exactly once per win screen visit
      if (!_starAwardedThisWin) {
        _totalStars++;
        _starAwardedThisWin = true;
        _starAnimTimer = 0;
      }
      _starAnimTimer++;
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
  text("Congrats!", ox + PLAY_WIDTH / 2, height / 2 - 80 + bounce);

  textSize(18);
  fill(180, 230, 255);
  text("You reached the top.", ox + PLAY_WIDTH / 2, height / 2 - 20);

  // ── Star reward ───────────────────────────────────────────────
  _drawStarReward(ox);

  let blink = frameCount % 50 < 30;
  if (blink) {
    textSize(14);
    fill(140, 190, 240);
    text("Press R to climb again", ox + PLAY_WIDTH / 2, height / 2 + 120);
  }
  textAlign(LEFT, BASELINE);
}

// ── Star reward rendering ─────────────────────────────────────
function _drawStarReward(ox) {
  let centerX = ox + PLAY_WIDTH / 2;
  let centerY = height / 2 + 45;

  // Label
  textFont("monospace");
  textSize(13);
  textAlign(CENTER, CENTER);
  fill(180, 230, 255, 200);
  noStroke();
  text("LEVEL 1 STAR COLLECTED", centerX, centerY - 28);

  let animT = constrain(_starAnimTimer / STAR_ANIM_DURATION, 0, 1);

  let starSize = 28;
  let starGap = 38;
  let totalW = (_totalStars - 1) * starGap;
  let startX = centerX - totalW / 2;

  for (let i = 0; i < _totalStars; i++) {
    let sx = startX + i * starGap;
    let sy = centerY + 8;
    let isNewest = i === _totalStars - 1;

    // easeOutBack pop-in for the newest star; clamp so scale() never goes <= 0
    let s = isNewest ? max(0.01, _easeOutBack(animT)) : 1.0;

    push();
    translate(sx, sy);
    scale(s);

    // Fading glow behind the newest star while the animation plays
    if (isNewest && animT < 1.0) {
      let glowA = round(map(animT, 0, 1, 200, 0));
      noStroke();
      fill(255, 230, 80, glowA);
      ellipse(0, 0, starSize * 2.2, starSize * 2.2);
    }

    // Star body
    noStroke();
    fill(255, 218, 50);
    _drawStarShape(0, 0, starSize * 0.42, starSize * 0.9, 5);

    // Shine highlight
    fill(255, 255, 200, 160);
    _drawStarShape(-2, -3, starSize * 0.18, starSize * 0.38, 5);

    pop();
  }
}

// Draws a 5-pointed star centered at (cx, cy)
function _drawStarShape(cx, cy, r1, r2, pts) {
  beginShape();
  for (let i = 0; i < pts * 2; i++) {
    let angle = (PI / pts) * i - PI / 2;
    let r = i % 2 === 0 ? r2 : r1;
    vertex(cx + cos(angle) * r, cy + sin(angle) * r);
  }
  endShape(CLOSE);
}

// easeOutBack: slight overshoot then settle — satisfying pop feel
// max(0.001) prevents p5 scale() from receiving 0 or negative values
function _easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  let v = 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2);
  return max(0.001, v);
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
  if (currentScreen === "intro") return;

  if (currentScreen === "game") {
    gameKeyPressed(keyCode);
  }
  if (
    (currentScreen === "win" || currentScreen === "lose") &&
    (key === "r" || key === "R")
  ) {
    // Reset the per-win guard so the next completion awards a new star
    _starAwardedThisWin = false;
    currentScreen = "game";
    initGame();
    _initBlur();
    bgMusic.loop();
  }
}

function keyReleased() {
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
