// ==============================
// ANXIOUS BLOB + SHRINKING ROOM (CLAUSTROPHOBIA)
// ==============================

// Player character (soft, animated blob)
let blob3 = {
  // Position (centre of the blob)
  x: 80,
  y: 0,

  // Collision radius (USED FOR ROOM BOUNDS)
  r: 26,

  // Draw radius (breathing) — visual only
  drawR: 26,

  // Blob drawing (soft edge)
  points: 48,
  wobble: 7,
  wobbleFreq: 0.9,

  // Time for Perlin wobble
  t: 0,
  tSpeed: 0.01,

  // Physics
  vx: 0,
  vy: 0,
  accel: 0.55,
  maxRun: 4.0,
  gravity: 0.65,
  jumpV: -11.0,

  // Ground state (true when touching the bottom of the room)
  onGround: false,

  // Friction
  frictionAir: 0.995,
  frictionGround: 0.88,

  // ---------------------------
  // Anxious behavior variables
  // ---------------------------

  // Autonomous pacing
  targetX: 200,
  retargetTimer: 0,

  // Jitter / shake
  jitterBase: 1.5,
  jitterSpike: 0,

  // Breathing
  breathT: 0,
  breathSpeed: 0.12,
  breathAmount: 0.08,
  breathSpike: 0,

  // Hop bob (visual)
  hopT: 0,
  hopSpeed: 0.18,
  hopHeight: 10,

  // Key-press fear cooldown
  scareCooldown: 0,
};

// ==============================
// (ADDED) Environment: shrinking room
// ==============================
let room = {
  x: 0,
  y: 0,
  w: 640,
  h: 360,

  shrinkSpeed: 0.5, // how fast the walls close in (tune this)
  minW: 150, // smallest room width
  minH: 150, // smallest room height
};

function setup() {
  createCanvas(640, 360);
  noStroke();
  textFont("sans-serif");
  textSize(14);

  // Start on the "floor" (bottom of canvas)
  blob3.y = height - blob3.r - 1;

  // Initial pacing target
  blob3.targetX = random(width * 0.2, width * 0.8);
  blob3.retargetTimer = int(random(30, 90));

  // Initialize room to full canvas
  room.w = width;
  room.h = height;
  room.x = 0;
  room.y = 0;
}

function draw() {
  background(240);

  // =========================
  // 0) Shrinking room update
  // =========================

  // Shrink room over time (claustrophobia)
  if (room.w > room.minW) room.w -= room.shrinkSpeed;
  if (room.h > room.minH) room.h -= room.shrinkSpeed;

  // Keep room centered while shrinking
  room.x = (width - room.w) / 2;
  room.y = (height - room.h) / 2;

  // Visualize closing walls (border)
  push();
  noFill();
  stroke(0);
  strokeWeight(3);
  rect(room.x, room.y, room.w, room.h);
  pop();

  // Optional: darken outside the room for stronger claustrophobia
  fill(0, 70);
  rect(0, 0, width, room.y); // top
  rect(0, room.y + room.h, width, height - (room.y + room.h)); // bottom
  rect(0, room.y, room.x, room.h); // left
  rect(room.x + room.w, room.y, width - (room.x + room.w), room.h); // right

  // =========================
  // 0.5) Escalate anxiety as room shrinks
  // =========================
  let cramped = 1 - room.w / width; // 0 -> 1
  blob3.jitterBase = 1.5 + cramped * 4.0;
  blob3.breathSpeed = 0.12 + cramped * 0.12;
  blob3.breathAmount = 0.08 + cramped * 0.06;

  // =========================
  // 1) Autonomous pacing
  // =========================
  blob3.retargetTimer--;
  if (blob3.retargetTimer <= 0) {
    // Retarget within the room (so pacing matches shrinking environment)
    blob3.targetX = random(room.x + room.w * 0.15, room.x + room.w * 0.85);
    blob3.retargetTimer = int(random(25, 80));
  }

  let dir = 0;
  if (blob3.x < blob3.targetX - 8) dir = 1;
  else if (blob3.x > blob3.targetX + 8) dir = -1;

  // Nervous movement nudge so it never looks smooth
  let nervousNudge = random(-0.12, 0.12);

  // Apply horizontal acceleration
  blob3.vx += blob3.accel * (dir + nervousNudge);

  // Optional tiny flinch hops (physical)
  if (blob3.onGround && random() < 0.02) {
    blob3.vy = -3.2;
    blob3.onGround = false;
  }

  // =========================
  // 2) Physics
  // =========================
  blob3.vx *= blob3.onGround ? blob3.frictionGround : blob3.frictionAir;
  blob3.vx = constrain(blob3.vx, -blob3.maxRun, blob3.maxRun);

  blob3.vy += blob3.gravity;

  // Move
  blob3.x += blob3.vx;
  blob3.y += blob3.vy;

  // =========================
  // 3) Room boundaries (instead of full canvas boundaries)
  // =========================

  // Left/right walls
  if (blob3.x < room.x + blob3.r) {
    blob3.x = room.x + blob3.r;
    blob3.vx *= -1;
  }
  if (blob3.x > room.x + room.w - blob3.r) {
    blob3.x = room.x + room.w - blob3.r;
    blob3.vx *= -1;
  }

  // Floor (bottom of room)
  if (blob3.y > room.y + room.h - blob3.r) {
    blob3.y = room.y + room.h - blob3.r;
    blob3.vy *= -0.6; // loses energy (soft bounce)
    blob3.onGround = true;
  } else {
    blob3.onGround = false;
  }

  // Ceiling (top of room)
  if (blob3.y < room.y + blob3.r) {
    blob3.y = room.y + blob3.r;
    blob3.vy *= -1;
  }

  // =========================
  // 4) Anxiety visuals
  // =========================
  blob3.t += blob3.tSpeed;

  // Breathing (visual only)
  blob3.breathT += blob3.breathSpeed;
  let breathWave = sin(blob3.breathT);
  let breathScale = 1 + breathWave * (blob3.breathAmount + blob3.breathSpike);
  blob3.drawR = blob3.r * breathScale;

  // Hop timer (visual bob)
  blob3.hopT += blob3.hopSpeed;

  // Decay fear spikes
  blob3.jitterSpike *= 0.86;
  blob3.breathSpike *= 0.9;

  // Cooldown decay
  if (blob3.scareCooldown > 0) blob3.scareCooldown--;

  // Draw blob
  drawBlobCircle(blob3);

  // HUD
  fill(0);
  text(
    "Claustrophobia: room shrinks • Blob grows/jitters when keys are pressed",
    10,
    18,
  );
}

function drawBlobCircle(b) {
  // Jitter offsets
  let jAmt = b.jitterBase + b.jitterSpike;
  let jx = random(-jAmt, jAmt);
  let jy = random(-jAmt, jAmt);

  // Hop bob (visual)
  let hopWave = max(0, sin(b.hopT));
  let hopY = -hopWave * b.hopHeight;

  fill(20, 120, 255);
  beginShape();

  for (let i = 0; i < b.points; i++) {
    const a = (i / b.points) * TAU;

    const n = noise(
      cos(a) * b.wobbleFreq + 100,
      sin(a) * b.wobbleFreq + 100,
      b.t,
    );

    const rr = b.drawR + map(n, 0, 1, -b.wobble, b.wobble);

    vertex(b.x + jx + cos(a) * rr, b.y + jy + hopY + sin(a) * rr);
  }

  endShape(CLOSE);
}

// Fear reaction: ANY key press triggers startled jump + size/jitter spike
function keyPressed() {
  if (blob3.scareCooldown > 0) return;

  if (blob3.onGround) {
    blob3.vy = blob3.jumpV * 1.08;
    blob3.onGround = false;
    blob3.vx += random(-3.5, 3.5);
  } else {
    blob3.vx += random(-2.5, 2.5);
    blob3.vy += random(-2.0, 1.0);
  }

  // Visual spikes (edit these to control fear intensity)
  blob3.jitterSpike = 9;
  blob3.breathSpike = 0.25; // <-- controls how big it "grows" on key press

  // Reset pacing target inside the room
  blob3.targetX = random(room.x + room.w * 0.15, room.x + room.w * 0.85);
  blob3.retargetTimer = int(random(15, 50));

  blob3.scareCooldown = 6;
}
