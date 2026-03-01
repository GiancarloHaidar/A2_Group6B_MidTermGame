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
    this.inputLeft = false;
    this.inputRight = false;
    this.inputJump = false; // single-frame flag
  }

  update(platforms) {
    // ── Horizontal movement ──────────────────────────────────
    let targetVx = 0;
    if (this.inputLeft) targetVx -= MOVE_SPEED;
    if (this.inputRight) targetVx += MOVE_SPEED;
    this.vx = lerp(this.vx, targetVx, GROUND_FRICTION);

    if (this.inputRight) this.facingRight = true;
    if (this.inputLeft) this.facingRight = false;

    // ── Jump ────────────────────────────────────────────────
    if (this.inputJump && this.onGround) {
      this.vy = JUMP_FORCE;
      this.onGround = false;
    }
    this.inputJump = false; // consume

    // ── Gravity ─────────────────────────────────────────────
    this.vy += GRAVITY;
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

    // Clamp horizontal to level width
    this.x = constrain(this.x, 0, LEVEL_WIDTH - this.w);
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
    let overlapLeft = this.x + this.w - p.x;
    let overlapRight = p.x + p.w - this.x;
    let overlapTop = this.y + this.h - p.y;
    let overlapBot = p.y + p.h - this.y;

    // Find smallest overlap (push out that way)
    let minX = min(overlapLeft, overlapRight);
    let minY = min(overlapTop, overlapBot);

    if (minY < minX) {
      // Vertical resolution
      if (overlapTop < overlapBot) {
        // Landing on top
        this.y = p.y - this.h;
        if (this.vy > 0) this.vy = 0;
        this.onGround = true;
      } else {
        // Hitting from below
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

    // Body
    fill(220, 200, 160);
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
      line(
        this.x + this.w * 0.3,
        this.y + this.h,
        this.x + this.w * 0.2,
        this.y + this.h + 8,
      );
      line(
        this.x + this.w * 0.7,
        this.y + this.h,
        this.x + this.w * 0.8,
        this.y + this.h + 8,
      );
    }
    noStroke();
  }
}
