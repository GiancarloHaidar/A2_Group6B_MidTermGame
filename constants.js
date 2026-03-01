// ============================================================
// constants.js
// All tunable values in one place — edit freely
// ============================================================

// ── Player dimensions ────────────────────────────────────────
const PLAYER_W = 28; // px
const PLAYER_H = 40; // px

// ── Movement ─────────────────────────────────────────────────
const MOVE_SPEED = 3.8; // px/frame max horizontal speed
const GROUND_FRICTION = 0.25; // lerp toward target vx (0=instant stop, 1=no friction)
const JUMP_FORCE = -11.5; // negative = upward (px/frame)
const GRAVITY = 0.5; // px/frame² added each frame
const MAX_FALL_SPEED = 18; // terminal velocity (px/frame)

// ── Fast-fall ────────────────────────────────────────────────
const FAST_FALL_MULTIPLIER = 3.0; // gravity multiplier when holding DOWN/S in air

// ── Energy / Fatigue ─────────────────────────────────────────
// Model: movement-distance based, not time based.
// Energy only drains when the player actually moves.
// Idle on a platform = zero drain.  Careful pace = sustainable.
// Mistakes (falls, spam jumps, fast movement) punish.
const ENERGY_MAX = 100;

// Per px of horizontal distance traveled (applies on ground AND in air).
// Clean run (30 platforms, ~80px walk each): costs ~30 energy from horizontal alone.
const ENERGY_DRAIN_HORIZ = 0.004;

// Flat cost deducted once per jump at the moment of takeoff.
// 30 jumps = 12 energy. Spam jumping burns budget.
const ENERGY_DRAIN_JUMP = 0.7;

// Extra drain per frame when downward vy exceeds comfortable fall speed.
// Only fires on fast falls — a normal landing costs nothing extra.
const ENERGY_DRAIN_FALL_OVER = 0.08;
const ENERGY_FALL_THRESHOLD = 9; // px/frame downward — below this, free fall

// Deadzone: speed below this contributes nothing to drain (kills idle jitter).
const ENERGY_MOVE_DEADZONE = 0.4; // px/frame

// Below this the bar turns red and speed penalty kicks in hard.
const ENERGY_LOW_THRESHOLD = 25;
// Minimum fraction of MOVE_SPEED kept at zero energy (player can still reach a platform).
const ENERGY_SPEED_MIN = 0.35;

// Checkpoint restore: +40% of max, hard cap at 70% of max.
const ENERGY_CHECKPOINT_ADD = 0.4;
const ENERGY_CHECKPOINT_CAP = 0.7;

// ── UI layout ────────────────────────────────────────────────
const UI_TOP_RESERVE = 56; // px — widened from 48 to fit energy bar + zone label

// ── Camera ───────────────────────────────────────────────────
const CAM_LERP = 0.1; // 0 = no follow, 1 = instant
const CAM_ANCHOR_Y = 0.55; // fraction of screen height where player is held

// ── Level / play column ──────────────────────────────────────
// The game world is a fixed-width column centred on screen.
// Platforms and player coords are in 0..PLAY_WIDTH space.
// LEVEL_HEIGHT is the full scrollable height of that column.
const PLAY_WIDTH = 800; // px — width of the playable column (world units)
const LEVEL_HEIGHT = 4000; // px — total scrollable height
