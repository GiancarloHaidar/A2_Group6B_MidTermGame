// ============================================================
// Player.js
// Handles movement, physics, jump, AABB collision with platforms.
//
// Imbalance system (three layers, all fatigue-scaled):
//
//  Layer 1 — Delayed stabilization
//    Ground friction when releasing input varies with energy level.
//    High energy → crisp stop. Low energy → sluggish coast with a
//    tiny spring-overshoot as the body "re-finds" its centre.
//
//  Layer 2 — Idle / movement sway
//    A sinusoidal offset added to vx each frame, scaled by BOTH
//    current speed and fatigue. Zero effect when standing still at
//    full energy. Strongest when running with low energy.
//
//  Layer 3 — Platform wobble (handled in gameScreen.js)
//    Upper platforms oscillate horizontally; collision uses updated
//    p.x directly so no changes here are needed for that layer.
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
    // onCheckpoint: set by gameScreen.js — suppresses sway while resting.
    // _wobblePhase: continuous accumulator so the cycle never resets.
    // _prevHasInput: tracks whether input was held last frame, used to
    //   detect the exact frame the player releases a key (overshoot trigger).
    this.onCheckpoint  = false;
    this._wobblePhase  = 0;
    this._prevHasHorizInput = false;
  }

  // ── Energy helpers ──────────────────────────────────────────

  // 0..1 speed multiplier based on energy.
  // sqrt curve: penalty is gradual, not a sudden cliff.
  energySpeedMultiplier() {
    let t = constrain(this.energy / ENERGY_MAX, 0, 1);
    return ENERGY_SPEED_MIN + (1 - ENERGY_SPEED_MIN) * sqrt(t);
  }

  // Returns the ground-friction value to use when NO input is held
  // and the player is on the ground (delayed stabilization, Layer 1).
  // Interpolates across three energy bands:
  //   > FATIGUE_HIGH  → FRICTION_HIGH  (crisp)
  //   FATIGUE_MID..HIGH → lerp HIGH→MID  (mild drift)
  //   < FATIGUE_MID   → lerp MID→LOW   (sluggish coast)
  _balanceFriction() {
    let t = constrain(this.energy / ENERGY_MAX, 0, 1);
    if (t >= BALANCE_FATIGUE_HIGH) {
      return BALANCE_FRICTION_HIGH;
    } else if (t >= BALANCE_FATIGUE_MID) {
      // Normalise t within the MID→HIGH band
      let band = (t - BALANCE_FATIGUE_MID) / (BALANCE_FATIGUE_HIGH - BALANCE_FATIGUE_MID);
      return lerp(BALANCE_FRICTION_MID, BALANCE_FRICTION_HIGH, band);
    } else {
      // Normalise t within the 0→MID band
      let band = t / BALANCE_FATIGUE_MID;
      return lerp(BALANCE_FRICTION_LOW, BALANCE_FRICTION_MID, band);
    }
  }

  // Returns how much of the spring-overshoot correction to apply.
  // 0 above FATIGUE_HIGH (no overshoot when fresh).
  // Scales linearly to 1 at FATIGUE_MID, stays at 1 below it.
  _overshootStrength() {
    let t = constrain(this.energy / ENERGY_MAX, 0, 1);
    if (t >= BALANCE_FATIGUE_HIGH) return 0;
    let band = 1 - (t - BALANCE_FATIGUE_MID) /
                     (BALANCE_FATIGUE_HIGH - BALANCE_FATIGUE_MID);
    return constrain(band, 0, 1);
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

    // ── Layer 1: Friction selection ──────────────────────────
    // When active input is held OR we are in the air, use the snappy
    // GROUND_FRICTION (0.25) so jump arcs are predictable.
    // When input is released on the ground, use the fatigue-scaled
    // balance friction for the delayed-stabilization feel.
    let friction;
    if (hasHorizInput || !this.onGround) {
      friction = GROUND_FRICTION;
    } else {
      friction = this._balanceFriction();
    }
    this.vx = lerp(this.vx, targetVx, friction);

    // ── Layer 1: Overshoot spring-damper ─────────────────────
    // Fires on the first frame after input is released, on the ground,
    // and only when there is meaningful fatigue (overshootStrength > 0).
    // The spring gently pulls vx back toward 0 once it overshoots,
    // creating the "body catching itself" micro-lurch.
    let justReleasedInput = this._prevHasHorizInput && !hasHorizInput;
    if (justReleasedInput && this.onGround) {
      let os = this._overshootStrength();
      if (os > 0 && abs(this.vx) > 0.05) {
        // Add a small counter-nudge: damped spring toward zero.
        // BALANCE_OVERSHOOT_K * os pulls opposite to current motion.
        this.vx -= this.vx * BALANCE_OVERSHOOT_K * os;
      }
    }
    this._prevHasHorizInput = hasHorizInput;

    // ── Jump ────────────────────────────────────────────────
    if (this.inputJump && this.onGround && !this.isExhausted) {
      this.vy       = JUMP_FORCE;
      this.onGround = false;
      this.energy   = max(0, this.energy - ENERGY_DRAIN_JUMP);
      if (this.energy === 0) this.isExhausted = true;
    }
    this.inputJump = false; // consume every frame

    // ── Gravity ─────────────────────────────────────────────
    let gravThisFrame = GRAVITY;
    if (this.inputDown && !this.onGround)
      gravThisFrame = GRAVITY * FAST_FALL_MULTIPLIER;
    this.vy += gravThisFrame;
    this.vy  = constrain(this.vy, -MAX_FALL_SPEED, MAX_FALL_SPEED);

    // ── Layer 2: Idle / movement sway ────────────────────────
    this._applyBalanceSway();

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

  // ── Layer 2: Sway implementation ─────────────────────────────
  // Sine wave added to vx, modulated by two independent scalars:
  //
  //   speedScale   = |vx| / MOVE_SPEED   — zero sway when stationary
  //   fatigueScale = 1 − energyFraction  — zero sway at full energy
  //
  // The product means a fresh, stationary player has virtually no sway.
  // A tired, running player has the most. The maximum possible addition
  // per frame is PLAYER_SWAY_AMP (≈ 0.30 px) — never enough to push an
  // idle player off a narrow edge.
  _applyBalanceSway() {
    this._wobblePhase += PLAYER_SWAY_FREQ;

    let checkpointMul = this.onCheckpoint ? PLAYER_SWAY_CHECKPOINT_DAMPEN : 1.0;

    // How fast is the player moving right now? (0 = idle, 1 = full speed)
    let speedScale = min(abs(this.vx) / MOVE_SPEED, 1.0);

    // How fatigued is the player? (0 = fresh, 1 = exhausted)
    let energyFrac   = constrain(this.energy / ENERGY_MAX, 0, 1);
    let fatigueScale = 1 - energyFrac; // 0 at full energy, 1 at zero energy

    this.vx +=
      PLAYER_SWAY_AMP *
      speedScale *
      fatigueScale *
      checkpointMul *
      sin(this._wobblePhase);
  }

  // ── AABB resolution ──────────────────────────────────────────
  // Stand on top, block sides, block ceiling.
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

    let minX = min(overlapLeft,  overlapRight);
    let minY = min(overlapTop,   overlapBot);

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

    // Body colour shifts with energy:
    //   > LOW_THRESHOLD : warm skin tone
    //   → LOW_THRESHOLD : lerp toward yellow-grey
    //   isExhausted     : dull red-grey
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

    // Eyes
    let eyeOffsetX = this.facingRight ? this.w * 0.25 : -this.w * 0.25;
    fill(50);
    ellipse(cx + eyeOffsetX, cy - this.h * 0.15, 5, 5);

    // Legs
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
