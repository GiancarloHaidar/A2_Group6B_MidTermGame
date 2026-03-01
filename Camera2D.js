// ============================================================
// Camera2D.js
// Vertical-follow camera: keeps player near vertical anchor
// Horizontal: follows with lerp
// UI is drawn OUTSIDE camera.apply() / camera.reset()
// ============================================================

class Camera2D {
  constructor() {
    this.x = 0;
    this.y = 0;
  }

  update(target) {
    // Where we WANT the camera so the player appears at CAM_ANCHOR_Y (fraction of screen)
    let desiredX = target.x + target.w / 2 - width  / 2;
    let desiredY = target.y + target.h / 2 - height * CAM_ANCHOR_Y;

    // Lerp towards desired position
    this.x = lerp(this.x, desiredX, CAM_LERP);
    this.y = lerp(this.y, desiredY, CAM_LERP);

    // Clamp so we don't scroll past level edges
    this.x = constrain(this.x, 0, max(0, LEVEL_WIDTH  - width));
    this.y = constrain(this.y, 0, max(0, LEVEL_HEIGHT - height));
  }

  // Call before drawing world-space objects
  apply() {
    translate(-this.x, -this.y);
  }

  // Call after drawing world-space objects, before UI
  reset() {
    translate(this.x, this.y);
  }
}
