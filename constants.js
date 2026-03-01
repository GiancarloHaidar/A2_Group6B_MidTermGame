// ============================================================
// constants.js
// All tunable values in one place — edit freely
// ============================================================

// ── Player dimensions ────────────────────────────────────────
const PLAYER_W = 28; // px
const PLAYER_H = 40; // px

// ── Movement ─────────────────────────────────────────────────
const MOVE_SPEED = 3.8; // px/frame max horizontal speed
const GROUND_FRICTION = 0.25; // lerp factor toward target vx (0=instant stop, 1=no friction)
const JUMP_FORCE = -11.5; // negative = upward (px/frame)
const GRAVITY = 0.5; // px/frame² added each frame
const MAX_FALL_SPEED = 18; // terminal velocity (px/frame)

// ── Camera ───────────────────────────────────────────────────
const CAM_LERP = 0.1; // 0 = no follow, 1 = instant
const CAM_ANCHOR_Y = 0.55; // fraction of screen height where player is held (0.5 = center)

// ── Level dimensions ─────────────────────────────────────────
const LEVEL_WIDTH = 800; // px  (world units)
const LEVEL_HEIGHT = 4000; // px  (tall level, scroll upward)
