export const POSE_SEGMENTS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];

const FACE = {
  forehead: 10,
  nose: 1,
  chin: 152,
  cheekRight: 234,
  cheekLeft: 454,
  eyeRight: [33, 133],
  eyeLeft: [362, 263],
  mouth: [61, 291, 0, 17],
  width: [127, 356],
};

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function isValidLandmark(point, minimumVisibility = 0.45) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  if (point.x < -0.1 || point.x > 1.1 || point.y < -0.1 || point.y > 1.1) return false;
  if (Number.isFinite(point.visibility) && point.visibility < minimumVisibility) return false;
  if (Number.isFinite(point.presence) && point.presence < minimumVisibility) return false;
  return true;
}

export function toCanvas(point, width, height, mirror = true) {
  if (!isValidLandmark(point)) return null;
  return { x: (mirror ? 1 - point.x : point.x) * width, y: point.y * height };
}

function point(landmarks, index, width, height, mirror, minimumVisibility = 0.45) {
  const landmark = landmarks?.[index];
  if (!isValidLandmark(landmark, minimumVisibility)) return null;
  return toCanvas(landmark, width, height, mirror);
}

function unit(vector, fallback = { x: 0, y: 1 }) {
  const length = Math.hypot(vector.x, vector.y);
  return length > 0.0001 ? { x: vector.x / length, y: vector.y / length } : fallback;
}

function addScaled(origin, axis, amount) {
  return { x: origin.x + axis.x * amount, y: origin.y + axis.y * amount };
}

function zone(x, y, radius, priority) {
  if (![x, y, radius].every(Number.isFinite) || radius <= 0) return null;
  return { x, y, r: radius, priority };
}

function put(target, zoneId, value) {
  if (value) target[zoneId] = value;
}

export function computeZones({ poseLandmarks, faceLandmarks, width, height, mirror = true }) {
  const zones = {};
  const pose = poseLandmarks || [];
  const ls = point(pose, 11, width, height, mirror);
  const rs = point(pose, 12, width, height, mirror);
  const lh = point(pose, 23, width, height, mirror);
  const rh = point(pose, 24, width, height, mirror);

  if (ls && rs) {
    const shoulderWidth = distance(ls, rs);
    if (shoulderWidth >= 35 && shoulderWidth <= width * 0.9) {
      const shoulderMid = midpoint(ls, rs);
      const hipMid = lh && rh ? midpoint(lh, rh) : null;
      const down = hipMid ? unit({ x: hipMid.x - shoulderMid.x, y: hipMid.y - shoulderMid.y }) : { x: 0, y: 1 };
      const left = unit({ x: ls.x - shoulderMid.x, y: ls.y - shoulderMid.y }, { x: mirror ? 1 : -1, y: 0 });
      const radius = factor => clamp(shoulderWidth * factor, 14, 90);

      const neck = addScaled(shoulderMid, down, -shoulderWidth * 0.1);
      const chest = addScaled(shoulderMid, down, shoulderWidth * 0.22);
      const heart = addScaled(addScaled(shoulderMid, down, shoulderWidth * 0.2), left, shoulderWidth * 0.16);
      put(zones, "neck", zone(neck.x, neck.y, radius(0.1), 20));
      put(zones, "chest_lungs", zone(chest.x, chest.y, radius(0.24), 40));
      put(zones, "heart", zone(heart.x, heart.y, radius(0.11), 15));
      put(zones, "shoulder_left", zone(ls.x, ls.y, radius(0.11), 15));
      put(zones, "shoulder_right", zone(rs.x, rs.y, radius(0.11), 15));

      if (hipMid) {
        const abdomen = midpoint(shoulderMid, hipMid);
        put(zones, "abdomen", zone(abdomen.x, abdomen.y, radius(0.21), 35));
        put(zones, "hip", zone(hipMid.x, hipMid.y, radius(0.19), 30));
      }

      const jointRadius = radius(0.085);
      const joints = {
        elbow_left: 13, elbow_right: 14,
        wrist_left: 15, wrist_right: 16,
        knee_left: 25, knee_right: 26,
        ankle_left: 27, ankle_right: 28,
      };
      for (const [zoneId, index] of Object.entries(joints)) {
        const joint = point(pose, index, width, height, mirror);
        if (joint) put(zones, zoneId, zone(joint.x, joint.y, jointRadius, 10));
      }
    }
  }

  const face = faceLandmarks || [];
  const faceRight = point(face, FACE.width[0], width, height, mirror, 0);
  const faceLeft = point(face, FACE.width[1], width, height, mirror, 0);
  if (faceRight && faceLeft) {
    const faceWidth = distance(faceRight, faceLeft);
    if (faceWidth >= 30 && faceWidth <= width * 0.7) {
      const small = clamp(faceWidth * 0.09, 10, 34);
      const p = index => point(face, index, width, height, mirror, 0);
      const forehead = p(FACE.forehead);
      const nose = p(FACE.nose);
      const chin = p(FACE.chin);
      const earLeft = p(FACE.cheekLeft);
      const earRight = p(FACE.cheekRight);
      const eyeLeftA = p(FACE.eyeLeft[0]);
      const eyeLeftB = p(FACE.eyeLeft[1]);
      const eyeRightA = p(FACE.eyeRight[0]);
      const eyeRightB = p(FACE.eyeRight[1]);
      const mouthA = p(FACE.mouth[0]);
      const mouthB = p(FACE.mouth[1]);
      const lipTop = p(FACE.mouth[2]);
      const lipBottom = p(FACE.mouth[3]);

      if (forehead) put(zones, "head", zone(forehead.x, forehead.y - faceWidth * 0.16, clamp(faceWidth * 0.21, 18, 70), 30));
      if (eyeLeftA && eyeLeftB) {
        const eye = midpoint(eyeLeftA, eyeLeftB);
        put(zones, "eye_left", zone(eye.x, eye.y, small * 0.85, 10));
      }
      if (eyeRightA && eyeRightB) {
        const eye = midpoint(eyeRightA, eyeRightB);
        put(zones, "eye_right", zone(eye.x, eye.y, small * 0.85, 10));
      }
      if (nose) put(zones, "nose", zone(nose.x, nose.y, small, 10));
      if (mouthA && mouthB && lipTop && lipBottom) {
        const mouthMid = midpoint(mouthA, mouthB);
        mouthMid.y = lipTop.y + (lipBottom.y - lipTop.y) * 0.45;
        put(zones, "mouth", zone(mouthMid.x, mouthMid.y, small * 1.2, 10));
      }
      if (earLeft) put(zones, "ear_left", zone(earLeft.x, earLeft.y, small, 10));
      if (earRight) put(zones, "ear_right", zone(earRight.x, earRight.y, small, 10));
      if (chin) put(zones, "chin", zone(chin.x, chin.y, small, 10));
    }
  }
  return zones;
}

export function selectZone(tip, zones, previousZoneId = null, hysteresis = 0.12) {
  if (!tip || !Number.isFinite(tip.x) || !Number.isFinite(tip.y)) return null;
  const candidates = [];
  for (const [zoneId, candidate] of Object.entries(zones)) {
    const normalizedDistance = distance(tip, candidate) / candidate.r;
    const allowance = zoneId === previousZoneId ? 1 + hysteresis : 1;
    if (normalizedDistance <= allowance) {
      candidates.push({ zoneId, normalizedDistance, priority: candidate.priority ?? 100 });
    }
  }
  candidates.sort((a, b) => a.priority - b.priority || a.normalizedDistance - b.normalizedDistance || a.zoneId.localeCompare(b.zoneId));
  return candidates[0]?.zoneId || null;
}

function angle(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const denominator = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (denominator < 1e-8) return 0;
  const cosine = clamp((ab.x * cb.x + ab.y * cb.y) / denominator, -1, 1);
  return Math.acos(cosine) * 180 / Math.PI;
}

export function pointingTip(handLandmarks, width, height, mirror = true) {
  if (!Array.isArray(handLandmarks) || handLandmarks.length < 21) return null;
  const normalized = [0, 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 17, 18, 20].every(index => isValidLandmark(handLandmarks[index], 0));
  if (!normalized) return null;
  const indexStraight = angle(handLandmarks[5], handLandmarks[6], handLandmarks[8]) >= 145
    && angle(handLandmarks[6], handLandmarks[7], handLandmarks[8]) >= 145;
  const wrist = handLandmarks[0];
  const indexLong = distance(wrist, handLandmarks[8]) > distance(wrist, handLandmarks[6]) * 1.12;
  const folded = [[10, 12], [14, 16], [18, 20]].filter(([pip, tip]) =>
    distance(wrist, handLandmarks[tip]) < distance(wrist, handLandmarks[pip]) * 1.08
  ).length;
  if (!indexStraight || !indexLong || folded < 2) return null;
  return toCanvas(handLandmarks[8], width, height, mirror);
}

export function smoothPoint(previous, next, alpha = 0.42) {
  if (!next) return null;
  if (!previous) return next;
  return { x: previous.x + (next.x - previous.x) * alpha, y: previous.y + (next.y - previous.y) * alpha };
}
