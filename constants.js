// ============================================================
// constants.js
// All tunable values in one place — edit freely
// ============================================================

// ── Player dimensions ────────────────────────────────────────
const PLAYER_W = 28;        // px
const PLAYER_H = 40;        // px

// ── Movement ─────────────────────────────────────────────────
const MOVE_SPEED      = 3.8;  // px/frame max horizontal speed
const GROUND_FRICTION = 0.25; // lerp toward target vx (0=instant stop, 1=no friction)
const JUMP_FORCE      = -11.5; // negative = upward (px/frame)
const GRAVITY         = 0.5;  // px/frame² added each frame
const MAX_FALL_SPEED  = 18;   // terminal velocity (px/frame)

// ── Fast-fall ────────────────────────────────────────────────
const FAST_FALL_MULTIPLIER = 3.0; // gravity multiplier when holding DOWN/S in air

// ── Energy / Fatigue ─────────────────────────────────────────
const ENERGY_MAX              = 100;  // full bar value
const ENERGY_DRAIN_BASE       = 7;    // units/sec drained while moving (walking or airborne)
const ENERGY_DRAIN_SPRINT     = 10;   // extra units/sec when speed magnitude > threshold
const ENERGY_SPRINT_THRESHOLD = 2.8;  // px/frame speed that counts as sprinting
const ENERGY_LOW_THRESHOLD    = 25;   // below this: warning flash + hard speed penalty
const ENERGY_SPEED_MIN        = 0.35; // fraction of MOVE_SPEED kept at zero energy
// Checkpoint restore: +40% of max, hard cap at 70% of max (never fully refills)
const ENERGY_CHECKPOINT_ADD   = 0.40;
const ENERGY_CHECKPOINT_CAP   = 0.70;

// ── UI layout ────────────────────────────────────────────────
const UI_TOP_RESERVE = 56;  // px — widened from 48 to fit energy bar + zone label

// ── Camera ───────────────────────────────────────────────────
const CAM_LERP     = 0.1;   // 0 = no follow, 1 = instant
const CAM_ANCHOR_Y = 0.55;  // fraction of screen height where player is held

// ── Level / play column ──────────────────────────────────────
// The game world is a fixed-width column centred on screen.
// Platforms and player coords are in 0..PLAY_WIDTH space.
// LEVEL_HEIGHT is the full scrollable height of that column.
const PLAY_WIDTH   = 800;   // px — width of the playable column (world units)
const LEVEL_HEIGHT = 4000;  // px — total scrollable height
