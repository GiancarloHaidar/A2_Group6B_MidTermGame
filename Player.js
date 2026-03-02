// ============================================================
// Player.js
// Handles movement, physics, jump, AABB collision with platforms.
//
// Balance / imbalance system — three layers, ALL active from frame one:
//
//  Layer 1 — Delayed stabilization
//    When no horizontal input is held on the ground, vx decays using
//    BALANCE_FRICTION_BASE (slower than GROUND_FRICTION) so the player
//    always coasts before stopping. Fatigue reduces friction further.
//    A micro-lurch fires on the exact frame input is released.
//
//  Layer 2 — Active grounded sway
//    A sine wave is added to vx every grounded frame using a fixed
//    baseline amplitude, so the player wobbles even when standing still
//    at full energy. Fatigue increases the amplitude additively.
//
//  Layer 3 — Platform wobble (handled in gameScreen.js)
//    Upper platforms oscillate; collision reads updated p.x directly.
// ============================================================

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = PLAYER_W;
    this.h = PLAYER_H;

    this.vx = 0;
    this.vy = 0;

    this.onGround    = false;
    this.facingRight = true;

    // Input flags (set by gameScreen.js)
    this.inputLeft  = false;
    this.inputRight = false;
    this.inputJump  = false; // single-frame flag
    this.inputDown  = false; // held: fast-fall

    // ── Energy ────────────────────────────────────────────────
    this.energy      = ENERGY_MAX;
    this.isExhausted = false;

    // ── Balance state ────────────────────────────────────────
    // onCheckpoint   : set externally — partially suppresses sway at rest
    // _wobblePhase   : continuous so the sway cycle never resets on landing
    // _prevHorizInput: remembers last frame's input state to detect release
    this.onCheckpoint      = false;
    this._wobblePhase      = 0;
    this._prevHorizInput   = false;
  }

  // ── Energy helpers ──────────────────────────────────────────

  // 0→1 speed multiplier. sqrt curve: penalty is gradual, not a cliff.
  energySpeedMultiplier() {
    let t = constrain(this.energy / ENERGY_MAX, 0, 1);
    return ENERGY_SPEED_MIN + (1 - ENERGY_SPEED_MIN) * sqrt(t);
  }

  // ── Layer 1 helpers ─────────────────────────────────────────

  // Ground-release friction: ALWAYS uses balance friction (not GROUND_FRICTION).
  // Linearly reduces from BALANCE_FRICTION_BASE toward BALANCE_FRICTION_TIRED
  // as energy falls to BALANCE_FATIGUE_TIRED.
  _releaseFriction() {
    let t = constrain(this.energy / ENERGY_MAX, 0, 1);
    if (t >= BALANCE_FATIGUE_TIRED) {
      // Map t from [TIRED_THRESHOLD..1.0] → [BASE..BASE] then toward TIRED
      // Actually a simple lerp: at t=1.0 → BASE, at t=TIRED → TIRED
      let band = (t - BALANCE_FATIGUE_TIRED) / (1.0 - BALANCE_FATIGUE_TIRED);
      return lerp(BALANCE_FRICTION_TIRED, BALANCE_FRICTION_BASE, band);
    }
    // Below the fatigue threshold — full tired friction
    return BALANCE_FRICTION_TIRED;
  }

  // Overshoot nudge strength for the micro-lurch on key release.
  // Linearly interpolates BASE→TIRED as energy drops.
  _overshootK() {
    let t = constrain(this.energy / ENERGY_MAX, 0, 1);
    // t=1 (full energy) → BASE; t=0 (exhausted) → TIRED
    return lerp(BALANCE_OVERSHOOT_TIRED, BALANCE_OVERSHOOT_BASE, t);
  }

  refillAtCheckpoint() {
    let add = ENERGY_MAX * ENERGY_CHECKPOINT_ADD;
    let cap = ENERGY_MAX * ENERGY_CHECKPOINT_CAP;
    this.energy = min(this.energy + add, cap);
    if (this.energy > 0) this.isExhausted = false;
  }

  update(platforms) {
    // ── Energy drain ────────────────────────────────────────
    if (!this.isExhausted) {
      let absVx = abs(this.vx);
      if (absVx > ENERGY_MOVE_DEADZONE) {
        this.energy -= ENERGY_DRAIN_HORIZ * absVx;
      }
      if (this.vy > ENERGY_FALL_THRESHOLD) {
        this.energy -= ENERGY_DRAIN_FALL_OVER * (this.vy - ENERGY_FALL_THRESHOLD);
      }
      if (this.energy <= 0) {
        this.energy      = 0;
        this.isExhausted = true;
      }
    }

    // ── Horizontal movement ──────────────────────────────────
    let effectiveSpeed = this.isExhausted
      ? 0
      : MOVE_SPEED * this.energySpeedMultiplier();

    let hasHorizInput = this.inputLeft || this.inputRight;
    let targetVx = 0;
    if (this.inputLeft)  targetVx -= effectiveSpeed;
    if (this.inputRight) targetVx += effectiveSpeed;

    if (this.inputRight) this.facingRight = true;
    if (this.inputLeft)  this.facingRight = false;

    // ── Layer 1a: Friction ───────────────────────────────────
    // Active input or airborne → snappy GROUND_FRICTION so jump arcs
    // stay predictable and acceleration feels responsive.
    // Released on ground → always-on balance friction (slower stop).
    let friction;
    if (hasHorizInput || !this.onGround) {
      friction = GROUND_FRICTION;
    } else {
      friction = this._releaseFriction();
    }
    this.vx = lerp(this.vx, targetVx, friction);

    // ── Layer 1b: Micro-lurch on key release ─────────────────
    // Fires exactly once on the first grounded frame after releasing input.
    // Applies a small counter-nudge to vx — the "body catching itself" feel.
    // Always active; overshoot grows mildly with fatigue.
    let justReleased = this._prevHorizInput && !hasHorizInput;
    if (justReleased && this.onGround && abs(this.vx) > 0.05) {
      this.vx -= this.vx * this._overshootK();
    }
    this._prevHorizInput = hasHorizInput;

    // ── Jump ────────────────────────────────────────────────
    if (this.inputJump && this.onGround && !this.isExhausted) {
      this.vy       = JUMP_FORCE;
      this.onGround = false;
      this.energy   = max(0, this.energy - ENERGY_DRAIN_JUMP);
      if (this.energy === 0) this.isExhausted = true;
    }
    this.inputJump = false;

    // ── Gravity ─────────────────────────────────────────────
    let gravThisFrame = GRAVITY;
    if (this.inputDown && !this.onGround)
      gravThisFrame = GRAVITY * FAST_FALL_MULTIPLIER;
    this.vy += gravThisFrame;
    this.vy  = constrain(this.vy, -MAX_FALL_SPEED, MAX_FALL_SPEED);

    // ── Layer 2: Grounded sway ───────────────────────────────
    // Applied before position integration. Only fires when grounded
    // so the sway does not affect jump arcs or air control.
    if (this.onGround) {
      this._applyGroundedSway();
    }

    // ── Integrate position ───────────────────────────────────
    this.x += this.vx;
    this.y += this.vy;

    // ── Platform collision ───────────────────────────────────
    this.onGround = false;
    for (let p of platforms) {
      this._resolveAABB(p);
    }

    // ── World bounds ─────────────────────────────────────────
    if (this.y + this.h > LEVEL_HEIGHT) {
      this.y        = LEVEL_HEIGHT - this.h;
      this.vy       = 0;
      this.onGround = true;
    }
    this.x = constrain(this.x, 0, PLAY_WIDTH - this.w);
  }

  // ── Layer 2: Grounded sway implementation ────────────────────
  // Adds a sinusoidal offset to vx. Two additive components:
  //
  //   baseline  = PLAYER_SWAY_AMP_BASE                  (always on)
  //   fatigued  = PLAYER_SWAY_AMP_FATIGUE × fatigueT    (grows with tiredness)
  //   totalAmp  = baseline + fatigued
  //
  // fatigueT = 1 − energyFraction. At full energy: totalAmp = BASE.
  // At zero energy: totalAmp = BASE + FATIGUE.
  //
  // Checkpoint platforms partially suppress both components — but not
  // to zero, so the symptom is never fully absent.
  _applyGroundedSway() {
    this._wobblePhase += PLAYER_SWAY_FREQ;

    let checkpointMul = this.onCheckpoint ? PLAYER_SWAY_CHECKPOINT_DAMPEN : 1.0;

    let fatigueT = 1.0 - constrain(this.energy / ENERGY_MAX, 0, 1);
    let totalAmp = PLAYER_SWAY_AMP_BASE + PLAYER_SWAY_AMP_FATIGUE * fatigueT;

    this.vx += totalAmp * checkpointMul * sin(this._wobblePhase);
  }

  // ── AABB resolution ──────────────────────────────────────────
  _resolveAABB(p) {
    if (
      this.x + this.w <= p.x ||
      this.x >= p.x + p.w   ||
      this.y + this.h <= p.y ||
      this.y >= p.y + p.h
    ) return;

    let overlapLeft  = this.x + this.w - p.x;
    let overlapRight = p.x + p.w - this.x;
    let overlapTop   = this.y + this.h - p.y;
    let overlapBot   = p.y + p.h - this.y;

    let minX = min(overlapLeft, overlapRight);
    let minY = min(overlapTop,  overlapBot);

    if (minY < minX) {
      if (overlapTop < overlapBot) {
        this.y        = p.y - this.h;
        if (this.vy > 0) this.vy = 0;
        this.onGround = true;
      } else {
        this.y = p.y + p.h;
        if (this.vy < 0) this.vy = 0;
      }
    } else {
      if (overlapLeft < overlapRight) {
        this.x = p.x - this.w;
      } else {
        this.x = p.x + p.w;
      }
      this.vx = 0;
    }
  }

  draw() {
    let cx = this.x + this.w / 2;
    let cy = this.y + this.h / 2;

    let bodyR, bodyG, bodyB;
    if (this.isExhausted) {
      bodyR = 190; bodyG = 90;  bodyB = 80;
    } else if (this.energy < ENERGY_LOW_THRESHOLD) {
      let t = this.energy / ENERGY_LOW_THRESHOLD;
      bodyR = 220;
      bodyG = round(lerp(90,  200, t));
      bodyB = round(lerp(80,  160, t));
    } else {
      bodyR = 220; bodyG = 200; bodyB = 160;
    }
    fill(bodyR, bodyG, bodyB);
    noStroke();
    rect(this.x, this.y, this.w, this.h, 4);

    let eyeOffsetX = this.facingRight ? this.w * 0.25 : -this.w * 0.25;
    fill(50);
    ellipse(cx + eyeOffsetX, cy - this.h * 0.15, 5, 5);

    stroke(180, 160, 120);
    strokeWeight(2);
    if (this.onGround) {
      line(
        this.x + this.w * 0.3, this.y + this.h,
        this.x + this.w * 0.2, this.y + this.h + 8
      );
      line(
        this.x + this.w * 0.7, this.y + this.h,
        this.x + this.w * 0.8, this.y + this.h + 8
      );
    }
    noStroke();
  }
}
