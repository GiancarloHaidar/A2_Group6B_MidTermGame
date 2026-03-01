// ============================================================
// Player.js
// Handles movement, physics, jump, AABB collision with platforms
// ============================================================

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = PLAYER_W;
    this.h = PLAYER_H;

    this.vx = 0;
    this.vy = 0;

    this.onGround = false;
    this.facingRight = true;

    // Input flags (set by gameScreen.js)
    this.inputLeft  = false;
    this.inputRight = false;
    this.inputJump  = false; // single-frame flag
    this.inputDown  = false; // held: fast-fall

    // ── Energy ────────────────────────────────────────────────
    // energy runs from 0 (exhausted) to ENERGY_MAX (full).
    // isExhausted is set true the moment energy hits 0 and locks
    // movement until the level is restarted or a checkpoint refills.
    this.energy      = ENERGY_MAX;
    this.isExhausted = false;
  }

  // ── Energy helpers ───────────────────────────────────────────

  // Returns a 0..1 multiplier applied to MOVE_SPEED.
  // Uses sqrt so the curve is gradual — the player feels the penalty
  // well before it becomes severe, rather than a sudden cliff.
  //   Full energy  → 1.0  (no penalty)
  //   Half energy  → ~0.74
  //   Zero energy  → ENERGY_SPEED_MIN (0.35)
  energySpeedMultiplier() {
    let t = constrain(this.energy / ENERGY_MAX, 0, 1);
    return ENERGY_SPEED_MIN + (1 - ENERGY_SPEED_MIN) * sqrt(t);
  }

  // Call this when the player touches a checkpoint platform.
  // Adds 40% of max, but never exceeds 70% of max.
  refillAtCheckpoint() {
    let add = ENERGY_MAX * ENERGY_CHECKPOINT_ADD;
    let cap = ENERGY_MAX * ENERGY_CHECKPOINT_CAP;
    this.energy = min(this.energy + add, cap);
    // A checkpoint can pull you back from the edge but not un-exhaust you;
    // isExhausted stays false only if energy > 0 after the fill.
    if (this.energy > 0) this.isExhausted = false;
  }

  update(platforms) {
    // ── Energy: distance-based drain ────────────────────────
    // Charged per pixel traveled, not per second.
    // Standing still = zero drain. Careful movement = sustainable.
    // Mistakes (falls, spam jumps, sustained speed) punish.
    if (!this.isExhausted) {
      // Horizontal cost: proportional to |vx| this frame.
      // Deadzone filters out friction coast / physics jitter.
      let absVx = abs(this.vx);
      if (absVx > ENERGY_MOVE_DEADZONE) {
        this.energy -= ENERGY_DRAIN_HORIZ * absVx;
      }

      // Fall surcharge: only when falling fast (vy large & positive = downward).
      // Normal gravity descent costs nothing; a hard fall after a miss does.
      if (this.vy > ENERGY_FALL_THRESHOLD) {
        this.energy -= ENERGY_DRAIN_FALL_OVER * (this.vy - ENERGY_FALL_THRESHOLD);
      }

      if (this.energy <= 0) {
        this.energy      = 0;
        this.isExhausted = true;
      }
    }

    // ── Horizontal movement ──────────────────────────────────
    // When exhausted: targetVx stays 0 so the player coasts to a stop.
    // When low energy: effectiveSpeed is reduced smoothly via the curve.
    let effectiveSpeed = this.isExhausted
      ? 0
      : MOVE_SPEED * this.energySpeedMultiplier();

    let targetVx = 0;
    if (this.inputLeft)  targetVx -= effectiveSpeed;
    if (this.inputRight) targetVx += effectiveSpeed;
    this.vx = lerp(this.vx, targetVx, GROUND_FRICTION);

    if (this.inputRight) this.facingRight = true;
    if (this.inputLeft)  this.facingRight = false;

    // ── Jump ────────────────────────────────────────────────
    // Exhausted player cannot initiate a jump; they fall where they stand.
    if (this.inputJump && this.onGround && !this.isExhausted) {
      this.vy    = JUMP_FORCE;
      this.onGround = false;
      // Flat energy cost per jump. Deducted at takeoff, not over time.
      // Spam-jumping or missing a platform and re-jumping repeatedly burns budget.
      this.energy = max(0, this.energy - ENERGY_DRAIN_JUMP);
      if (this.energy === 0) this.isExhausted = true;
    }
    this.inputJump = false; // consume every frame regardless

    // ── Gravity ─────────────────────────────────────────────
    let gravThisFrame = GRAVITY;
    if (this.inputDown && !this.onGround)
      gravThisFrame = GRAVITY * FAST_FALL_MULTIPLIER;
    this.vy += gravThisFrame;
    this.vy = constrain(this.vy, -MAX_FALL_SPEED, MAX_FALL_SPEED);

    // ── Integrate position ───────────────────────────────────
    this.x += this.vx;
    this.y += this.vy;

    // ── Platform collision ───────────────────────────────────
    this.onGround = false;
    for (let p of platforms) {
      this._resolveAABB(p);
    }

    // ── World bounds (don't fall below level floor) ──────────
    if (this.y + this.h > LEVEL_HEIGHT) {
      this.y = LEVEL_HEIGHT - this.h;
      this.vy = 0;
      this.onGround = true;
    }

    // Clamp horizontal to play column
    this.x = constrain(this.x, 0, PLAY_WIDTH - this.w);
  }

  // AABB: stand on top, block sides, block ceiling
  _resolveAABB(p) {
    // Overlap check
    if (
      this.x + this.w <= p.x ||
      this.x >= p.x + p.w ||
      this.y + this.h <= p.y ||
      this.y >= p.y + p.h
    )
      return;

    // Calculate overlap on each axis
    let overlapLeft  = this.x + this.w - p.x;
    let overlapRight = p.x + p.w - this.x;
    let overlapTop   = this.y + this.h - p.y;
    let overlapBot   = p.y + p.h - this.y;

    // Push out along the axis of smallest overlap
    let minX = min(overlapLeft, overlapRight);
    let minY = min(overlapTop,  overlapBot);

    if (minY < minX) {
      // Vertical resolution
      if (overlapTop < overlapBot) {
        this.y = p.y - this.h;
        if (this.vy > 0) this.vy = 0;
        this.onGround = true;
      } else {
        this.y = p.y + p.h;
        if (this.vy < 0) this.vy = 0;
      }
    } else {
      // Horizontal resolution
      if (overlapLeft < overlapRight) {
        this.x = p.x - this.w;
      } else {
        this.x = p.x + p.w;
      }
      this.vx = 0;
    }
  }

  draw() {
    // Drawn in world space (camera already applied)
    let cx = this.x + this.w / 2;
    let cy = this.y + this.h / 2;

    // Body — colour shifts as energy drops:
    //   > LOW_THRESHOLD : normal warm skin tone
    //   → LOW_THRESHOLD : lerp toward yellow-grey
    //   isExhausted     : dull red-grey
    let bodyR, bodyG, bodyB;
    if (this.isExhausted) {
      bodyR = 190; bodyG = 90;  bodyB = 80;
    } else if (this.energy < ENERGY_LOW_THRESHOLD) {
      let t = this.energy / ENERGY_LOW_THRESHOLD; // 0 near death, 1 at threshold
      bodyR = 220;
      bodyG = round(lerp(90,  200, t));
      bodyB = round(lerp(80,  160, t));
    } else {
      bodyR = 220; bodyG = 200; bodyB = 160; // original colour
    }
    fill(bodyR, bodyG, bodyB);
    noStroke();
    rect(this.x, this.y, this.w, this.h, 4);

    // Eyes
    let eyeOffsetX = this.facingRight ? this.w * 0.25 : -this.w * 0.25;
    fill(50);
    ellipse(cx + eyeOffsetX, cy - this.h * 0.15, 5, 5);

    // Legs (simple indicator of onGround)
    stroke(180, 160, 120);
    strokeWeight(2);
    if (this.onGround) {
      line(this.x + this.w * 0.3, this.y + this.h,
           this.x + this.w * 0.2, this.y + this.h + 8);
      line(this.x + this.w * 0.7, this.y + this.h,
           this.x + this.w * 0.8, this.y + this.h + 8);
    }
    noStroke();
  }
}
