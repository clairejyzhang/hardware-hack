export const TURN_THRESHOLD = 45;
const GRIP_GRACE_MS = 650;
const TILT_THRESHOLD = 25;
const HOLD_THRESHOLD = 30;
const HOLD_GRACE_MS = 500;
const RELEASE_CONFIRM_MS = 220;
const REPEAT_MS = 500;

function direction(from, to) {
  return [to.x - from.x, to.y - from.y, to.z - from.z];
}

export function wristRoll(points) {
  if (!points?.[17]) return null;
  const across = direction(points[5], points[17]);
  const along = direction(points[0], points[9]);
  const [ax, ay, az] = across;
  const [lx, ly, lz] = along;
  const normal = [ay * lz - az * ly, az * lx - ax * lz, ax * ly - ay * lx];
  const acrossLength = Math.hypot(...across);
  const normalLength = Math.hypot(...normal);
  if (!acrossLength || normalLength < acrossLength * Math.hypot(...along) * 0.25) return null;

  // The two depth components distinguish palm-facing from back-of-hand-facing.
  const sideDepth = az / acrossLength;
  const palmDepth = normal[2] / normalLength;
  if (Math.hypot(sideDepth, palmDepth) < 0.45) return null;
  return Math.atan2(sideDepth, palmDepth) * 180 / Math.PI;
}

export function readHand(points, width, height, wasGripped, worldPoints) {
  if (!points || points.length < 21) return null;
  const distance = (a, b) => Math.hypot(
    (points[a].x - points[b].x) * width,
    (points[a].y - points[b].y) * height,
    ((points[a].z ?? 0) - (points[b].z ?? 0)) * width,
  );
  const scale = Math.max(distance(5, 17), distance(0, 9));
  if (scale < 12) return null;
  const dx = ((points[5].x + points[9].x + points[17].x) / 3 - points[0].x) * width;
  const dy = ((points[5].y + points[9].y + points[17].y) / 3 - points[0].y) * height;
  const tilt = Math.hypot(dx, dy) >= scale * 0.35 ? Math.atan2(dy, dx) * 180 / Math.PI : null;
  const pinchGap = distance(4, 8) / scale;
  const visibleGap = Math.hypot(
    (points[4].x - points[8].x) * width,
    (points[4].y - points[8].y) * height,
  ) / scale;
  // The fingertips can overlap during a roll, making estimated depth unstable.
  // Require a confident pinch to grab, then allow close visible tips to sustain it.
  const gripped = pinchGap < 0.28 || Boolean(wasGripped &&
    (pinchGap < 0.40 || (visibleGap < 0.30 && pinchGap < 0.85)));
  return {
    gripped,
    released: !gripped && wasGripped,
    roll: wristRoll(worldPoints),
    tilt,
  };
}

export class KnobTurns {
  turns = 0;
  degrees = 0;
  startRoll = null;
  startTilt = null;
  releaseSince = null;
  lastTurnSeen = null;
  lastGripTime = null;
  lastCountDirection = 0;
  activeDirection = 0;
  heldMs = 0;
  lastHoldSample = null;

  get holdingTurn() {
    return this.lastHoldSample !== null;
  }

  stopHoldingTurn() {
    this.activeDirection = 0;
    this.lastTurnSeen = null;
    this.heldMs = 0;
    this.lastHoldSample = null;
  }

  get gripped() {
    return this.lastGripTime !== null;
  }

  release() {
    this.startRoll = null;
    this.startTilt = null;
    this.releaseSince = null;
    this.lastGripTime = null;
    this.degrees = 0;
    this.lastCountDirection = 0;
    this.stopHoldingTurn();
  }

  update(hand, now = performance.now()) {
    if (this.gripped && now - this.lastGripTime > GRIP_GRACE_MS) this.release();
    if (hand?.released && this.gripped) {
      this.releaseSince ??= now;
      if (now - this.releaseSince >= RELEASE_CONFIRM_MS) this.release();
    } else if (hand?.gripped) {
      this.releaseSince = null;
      this.lastGripTime = now;
    }

    if (this.lastTurnSeen !== null && now - this.lastTurnSeen > HOLD_GRACE_MS) {
      this.stopHoldingTurn();
    }
    if (!hand?.gripped) {
      this.lastHoldSample = null;
      return;
    }

    if (hand.roll != null) this.startRoll ??= hand.roll;
    if (hand.tilt != null) this.startTilt ??= hand.tilt;
    const change = (angle, start) => angle == null || start == null
      ? 0 : (angle - start + 540) % 360 - 180;
    const roll = change(hand.roll, this.startRoll);
    // The mirrored preview matches the user's view, reversing image-space tilt.
    const tilt = -change(hand.tilt, this.startTilt) * TURN_THRESHOLD / TILT_THRESHOLD;
    const motion = Math.abs(tilt) >= Math.abs(roll) ? tilt : roll;
    this.degrees = Math.min(Math.abs(motion), TURN_THRESHOLD);
    const direction = Math.sign(motion);
    const sameDirection = direction === this.activeDirection;
    const threshold = sameDirection ? HOLD_THRESHOLD : TURN_THRESHOLD;
    if (this.degrees < threshold) {
      this.lastHoldSample = null;
      if (hand.roll != null && hand.tilt != null && this.degrees < 15) {
        this.stopHoldingTurn();
        this.lastCountDirection = 0;
      }
      return;
    }

    if (!sameDirection) this.stopHoldingTurn();
    this.activeDirection = direction;
    if (direction !== this.lastCountDirection) {
      this.turns += direction;
      this.lastCountDirection = direction;
    }
    if (this.holdingTurn) {
      const elapsed = now - this.lastHoldSample;
      if (elapsed <= HOLD_GRACE_MS) this.heldMs += elapsed;
    }
    this.lastHoldSample = now;
    this.lastTurnSeen = now;
    if (this.heldMs >= REPEAT_MS) {
      this.turns += direction;
      this.heldMs -= REPEAT_MS;
    }
  }
}
