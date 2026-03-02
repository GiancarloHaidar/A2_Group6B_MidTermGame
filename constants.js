// ============================================================
// constants.js
// All tunable values in one place — edit freely
// ============================================================

// ── Player dimensions ────────────────────────────────────────
const PLAYER_W = 28; // px
const PLAYER_H = 40; // px

// ── Movement ─────────────────────────────────────────────────
const MOVE_SPEED = 3.8; // px/frame max horizontal speed
const GROUND_FRICTION = 0.25; // lerp toward target vx when moving (kept for air use)
const JUMP_FORCE = -11.5; // negative = upward (px/frame)
const GRAVITY = 0.5; // px/frame² added each frame
const MAX_FALL_SPEED = 18; // terminal velocity (px/frame)

// ── Fast-fall ────────────────────────────────────────────────
const FAST_FALL_MULTIPLIER = 3.0; // gravity multiplier when holding DOWN/S in air

// ── Energy / Fatigue ─────────────────────────────────────────
// Model: movement-distance based, not time based.
// Energy only drains when the player actually moves.
// Idle on a platform = zero drain. Careful pace = sustainable.
// Mistakes (falls, spam jumps, fast movement) punish.
const ENERGY_MAX = 100;

// Per px of horizontal distance traveled (applies on ground AND in air).
const ENERGY_DRAIN_HORIZ = 0.004;

// Flat cost deducted once per jump at the moment of takeoff.
const ENERGY_DRAIN_JUMP = 0.4;

// Extra drain per frame when downward vy exceeds comfortable fall speed.
const ENERGY_DRAIN_FALL_OVER = 0.08;
const ENERGY_FALL_THRESHOLD = 9; // px/frame downward — below this, free fall

// Deadzone: speed below this contributes nothing to drain (kills idle jitter).
const ENERGY_MOVE_DEADZONE = 0.4; // px/frame

// Below this the bar turns red and speed penalty kicks in hard.
const ENERGY_LOW_THRESHOLD = 25;
// Minimum fraction of MOVE_SPEED kept at zero energy.
const ENERGY_SPEED_MIN = 0.35;

// Checkpoint restore: +40% of max, hard cap at 70% of max.
const ENERGY_CHECKPOINT_ADD = 0.4;
const ENERGY_CHECKPOINT_CAP = 0.7;

// ── Balance Instability ──────────────────────────────────────
// Three independent, stackable layers. All are fatigue-scaled so
// instability feels earned rather than arbitrary.
//
// ══════════════════════════════════════════════════════════════
// LAYER 1: Fatigue-scaled delayed stabilization
// ══════════════════════════════════════════════════════════════
// When no horizontal input is held on the ground, vx decays toward 0
// using a friction value interpolated from the player's current energy:
//
//   energy > 70% →  BALANCE_FRICTION_HIGH  (crisp, near-normal stop)
//   energy 40–70% → lerp toward BALANCE_FRICTION_MID  (mild drift coast)
//   energy < 40% →  lerp toward BALANCE_FRICTION_LOW  (sluggish, slides past)
//
// Using lerp-based friction (not impulse) means the slowdown is smooth
// and always directionally correct — the player never slides backward.
//
const BALANCE_FRICTION_HIGH = 0.22; // near GROUND_FRICTION — almost crisp stop
//   → Raise toward 0.25 to make "full energy" feel tighter.
const BALANCE_FRICTION_MID = 0.12; // mild coast; stop takes ~2× longer
//   → Lower to 0.08 for a more noticeable mid-range drift.
const BALANCE_FRICTION_LOW = 0.06; // sluggish; stop takes ~4–5× longer
//   → Lower to 0.04 for near-ice feel at exhaustion threshold.
//
// Energy band thresholds used to blend between the three friction values:
const BALANCE_FATIGUE_HIGH = 0.7; // above this → HIGH friction (mostly stable)
const BALANCE_FATIGUE_MID = 0.4; // above this → lerp HIGH→MID; below → lerp MID→LOW
//   Tip: keep FATIGUE_MID at 0.40 to match the "40–70%" description in the design doc.
//
// Overshoot spring damper: after releasing input, a small spring force
// nudges vx back toward 0 once it crosses zero — the "settling" feel.
// Scaled by fatigue: none above 70%, full below 40%.
const BALANCE_OVERSHOOT_K = 0.035; // spring constant — proportion of vx added back
//   → 0.035 = very subtle. Raise to 0.06 for more pronounced settling.

// ══════════════════════════════════════════════════════════════
// LAYER 2: Idle / movement sway
// ══════════════════════════════════════════════════════════════
// A slow sine wave is added to vx every frame. It has TWO scaling factors:
//
//   speedScale  = |vx| / MOVE_SPEED  (0 when idle, 1 at full speed)
//   fatigueScale = 1 − energyFraction (0 at full energy, 1 at exhaustion)
//
// Combined: sway ≈ 0 at idle + full energy; strongest when running + tired.
// A standing player on a platform edge will feel zero lateral push.
//
const PLAYER_SWAY_AMP = 0.3; // px/frame — peak sway at full speed + full fatigue
//   → 0.30 is the sweet spot: clearly felt when running low, invisible when rested.
//   → Raise to 0.45 for a more challenging exhausted-run feel.
//   → Lower to 0.15 for very subtle wobble throughout.
const PLAYER_SWAY_FREQ = 0.022; // radians/frame — sway oscillation speed
//   → 0.022 → ~4.5 s per full cycle (pendulum-like, legible).
//   → Raise to 0.035 for a quicker, more disorienting rhythm.
//
// Checkpoint suppression: sway drops to this fraction on a checkpoint platform.
const PLAYER_SWAY_CHECKPOINT_DAMPEN = 0.0; // 0.0 = fully suppressed at checkpoints

// ══════════════════════════════════════════════════════════════
// LAYER 3: Environmental platform wobble (altitude-scaled)
// ══════════════════════════════════════════════════════════════
// Platforms oscillate horizontally. Amplitude = AMP_MAX × altitude_t².
// altitude_t = 1 − (platform.y / LEVEL_HEIGHT)
// Square exponent → lower half nearly still, summit platforms clearly swaying.
// Collision uses the updated p.x directly — no collision code changes needed.
//
const PLAT_WOBBLE_AMP_MAX = 12; // px — maximum sweep at the very summit
//   → 12px is well within the safe margin on narrow (130 px) platforms.
//   → Raise to 18 for a more demanding summit. Keep below 20 to stay fair.
const PLAT_WOBBLE_FREQ = 0.018; // radians/frame — platform oscillation speed
//   → 0.018 → ~5.8 s per full swing (slow, clearly trackable).
//   → Raise to 0.028 for a livelier swing.

// ── UI layout ────────────────────────────────────────────────
const UI_TOP_RESERVE = 56; // px — widened to fit energy bar + zone label

// ── Camera ───────────────────────────────────────────────────
const CAM_LERP = 0.1; // 0 = no follow, 1 = instant
const CAM_ANCHOR_Y = 0.55; // fraction of screen height where player is held

// ── Level / play column ──────────────────────────────────────
const PLAY_WIDTH = 800; // px — width of the playable column (world units)
const LEVEL_HEIGHT = 4000; // px — total scrollable height
