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
// Two independent layers. Both are tunable via the constants below.
//
// ── Layer 1: Player drift (lazy deceleration after key release) ──
// When no horizontal key is held, vx decays toward 0 using this
// lower friction instead of GROUND_FRICTION (0.25).
//   Normal stop: ~6 frames.   Drift stop: ~20 frames.
// Flat across the whole level — consistent, readable.
const BALANCE_DRIFT_FRICTION = 0.4;
//   → Raise toward 0.25 to reduce drift. Lower toward 0.05 for icier feel.
//   → Only active on the ground; air friction is unchanged.
//
// ── Layer 2: Player body sway (constant, not altitude-scaled) ──
// A slow sine wave added to vx every frame regardless of height.
// Flat amplitude — the player always feels slightly unsteady,
// but it never gets worse as they climb.
const PLAYER_SWAY_AMP = 0.35; // px/frame — max sway when at full speed
//   Scaled by |vx|/MOVE_SPEED so idle player has zero sway (safe on any platform).
//   → Raise to 0.35 for a more disorienting movement feel.
//   → Lower to 0.10 for nearly imperceptible wobble during movement.
const PLAYER_SWAY_FREQ = 0.025; // radians/frame — sway cycle speed
//   → 0.025 → ~4s per full cycle (slower, pendulum-like, readable).
//   → Raise to 0.04 for a quicker oscillation.
//
// ── Layer 3: Platform wobble (altitude-scaled, env instability) ──
// Platforms at high altitude oscillate horizontally.
// Amplitude = PLAT_WOBBLE_AMP_MAX × altitude_t²
// where altitude_t = 1 − (platform.baseY / LEVEL_HEIGHT).
// Square curve: nearly zero in the lower half, strong near the summit.
const PLAT_WOBBLE_AMP_MAX = 15; // px — max side-to-side sweep at the summit
//   6px = well within the safe margin on the narrowest platform (102px usable).
//   → Raise to 10 for more challenge. Keep below 14 to stay fair.
const PLAT_WOBBLE_FREQ = 0.02; // radians/frame — platform oscillation speed
//   → 0.020 → ~5s per full swing (very slow, clearly trackable).
//   → Raise to 0.03 for a livelier swing.
//
// ── Checkpoint suppression ────────────────────────────────────
// Player sway drops to this fraction when onCheckpoint is true.
// 0.0 = fully suppressed at checkpoints.
const PLAYER_SWAY_CHECKPOINT_DAMPEN = 0.0;

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
