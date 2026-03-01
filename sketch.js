// ============================================================
// sketch.js — Conductor / Router
// ============================================================

let currentScreen = "game"; // "game" | "win"

let player;
let platforms;
let cam;
let levelData;

function preload() {
  levelData = loadJSON("level1.json");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  initGame();
}

function draw() {
  switch (currentScreen) {
    case "game":
      drawGame();
      break;
    case "win":
      drawWinScreen();
      break;
  }
}

function drawWinScreen() {
  let ox = (width - PLAY_WIDTH) / 2;
  background(10, 11, 16);

  // Side gutters same dark tone
  fill(10, 11, 16);
  noStroke();
  rect(0, 0, width, height);

  // Green gradient inside play column
  for (let i = 0; i < 8; i++) {
    let t = i / 8;
    fill(lerp(20, 10, t), lerp(60, 30, t), lerp(20, 15, t));
    rect(ox, (i * height) / 8, PLAY_WIDTH, height / 8);
  }

  // Stars burst background
  randomSeed(99);
  for (let i = 0; i < 40; i++) {
    let sx = ox + random(PLAY_WIDTH);
    let sy = random(height);
    let pulse = 0.5 + 0.5 * sin(frameCount * 0.05 + i);
    fill(255, 240, 120, 80 + 120 * pulse);
    noStroke();
    drawWinStar(sx, sy, 3, 7, 5);
  }

  // Main text
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

  // Restart prompt
  let blink = frameCount % 50 < 30;
  if (blink) {
    textSize(14);
    fill(160, 200, 160);
    text("Press R to climb again", ox + PLAY_WIDTH / 2, height / 2 + 70);
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
  if (currentScreen === "win" && (key === "r" || key === "R")) {
    currentScreen = "game";
    initGame();
  }
}

function keyReleased() {
  if (currentScreen === "game") {
    gameKeyReleased(keyCode);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
