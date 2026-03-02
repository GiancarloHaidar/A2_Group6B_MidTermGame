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
const ENERGY_DRAIN_JUMP = 0.4;

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

// ── Balance Instability ──────────────────────────────────────
// Physics-based approach — two independent layers added to vx each frame.
// No random impulses. All effects are continuous and tunable.
//
// ── Layer 1: Drift (lazy deceleration after key release) ─────
// When no horizontal key is held, vx decays toward 0 with this
// lower friction instead of the normal GROUND_FRICTION (0.25).
// Creates the "balance takes time to stabilise" feel.
//   Normal friction stops in ~6 frames.
//   Drift friction stops in ~20 frames — clearly noticeable coast.
const BALANCE_DRIFT_FRICTION = 0.1;
//   → Raise toward GROUND_FRICTION (0.25) to reduce drift effect.
//   → Lower toward 0.05 for an icier, harder-to-control feel.
//   → Only active on the ground; in-air friction is unchanged.
//
// ── Layer 2: Altitude-scaled sine sway ───────────────────────
// A slow sine wave is added directly to vx every frame.
// Amplitude scales from 0 at ground to WOBBLE_AMP at the summit.
// The wave runs continuously — it doesn't care about input state.
const WOBBLE_AMP = 0.6; // px/frame — max sway at summit
//   → 0.6 = 16% of MOVE_SPEED — clearly felt, never unfair.
//   → Raise to 0.9–1.2 for a more disruptive upper section.
//   → Lower to 0.3 for barely-perceptible sway.
const WOBBLE_FREQ = 0.04; // radians/frame — higher = faster oscillation
//   → 0.04 → period ≈ 157 frames ≈ 2.6s per full sway cycle (body-sway speed).
//   → 0.06 → ~1.7s per cycle (more agitated feeling).
//   → 0.025 → ~4s per cycle (very slow, pendulum-like).
//
// ── Level scaling (future levels) ────────────────────────────
// Multiply WOBBLE_AMP by this factor per level number.
// Level 1 = ×1.0, Level 2 = ×1.4, Level 3 = ×1.8 etc.
const WOBBLE_LEVEL_SCALE = 0.4; // added to multiplier per level above 1
//   → Set to 0 to disable cross-level scaling entirely.
//
// ── Checkpoint suppression ────────────────────────────────────
// Sway amplitude is multiplied by this when onCheckpoint is true.
// 0 = fully suppressed. 0.3 = still 30% sway even at checkpoint.
const WOBBLE_CHECKPOINT_DAMPEN = 0.0;

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
