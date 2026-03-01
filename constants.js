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

// ── UI layout ────────────────────────────────────────────────
// Reserve this many px at the top for future UI (energy bar etc.)
const UI_TOP_RESERVE = 48;  // px  ← increase when you add the energy bar

// ── Camera ───────────────────────────────────────────────────
const CAM_LERP     = 0.1;   // 0 = no follow, 1 = instant
const CAM_ANCHOR_Y = 0.55;  // fraction of screen height where player is held

// ── Level / play column ──────────────────────────────────────
// The game world is a fixed-width column centred on screen.
// Platforms and player coords are in 0..PLAY_WIDTH space.
// LEVEL_HEIGHT is the full scrollable height of that column.
const PLAY_WIDTH   = 800;   // px — width of the playable column (world units)
const LEVEL_HEIGHT = 4000;  // px — total scrollable height
