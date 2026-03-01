// ============================================================
// sketch.js — Conductor / Router
// Loads assets, manages currentScreen, routes input
// ============================================================

let currentScreen = "game"; // "start" | "game" | "win" | "lose"

// Shared game objects (created in gameScreen.js)
let player;
let platforms;
let cam;
let levelData;

function preload() {
  levelData = loadJSON("level1.json");
}

function setup() {
  // PARENT: document.body — p5 appends canvas here, CSS keeps body margin-free
  createCanvas(windowWidth, windowHeight);
  initGame(); // defined in gameScreen.js
}

function draw() {
  switch (currentScreen) {
    case "game":
      drawGame();
      break;
    // Future screens plug in here
  }
}

function keyPressed() {
  if (currentScreen === "game") {
    gameKeyPressed(keyCode);
  }
}

function keyReleased() {
  if (currentScreen === "game") {
    gameKeyReleased(keyCode);
  }
}

function windowResized() {
  // Resize the p5 drawing buffer to match the new viewport exactly.
  // The camera's constrain() calls in Camera2D.update() use width/height
  // which p5 updates automatically, so no camera code needs to change.
  resizeCanvas(windowWidth, windowHeight);
}
