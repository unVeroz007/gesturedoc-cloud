import assert from "node:assert/strict";
import test from "node:test";

import { computeZones, indexTip, pointingTip, selectZone, toCanvas } from "../src/geometry.js";

function landmarks(size) {
  return Array.from({ length: size }, () => ({ x: 0.5, y: 0.5, visibility: 1, presence: 1 }));
}

test("all overlay coordinates use the same mirror transform", () => {
  assert.deepEqual(toCanvas({ x: 0.2, y: 0.3, visibility: 1 }, 640, 480), { x: 512, y: 144 });
});

test("bilateral pose joints remain separate and heart follows anatomical left", () => {
  const pose = landmarks(33);
  Object.assign(pose[11], { x: 0.25, y: 0.3 });
  Object.assign(pose[12], { x: 0.75, y: 0.35 });
  Object.assign(pose[23], { x: 0.32, y: 0.7 });
  Object.assign(pose[24], { x: 0.68, y: 0.72 });
  Object.assign(pose[15], { x: 0.12, y: 0.58 });
  Object.assign(pose[16], { x: 0.88, y: 0.62 });
  const zones = computeZones({ poseLandmarks: pose, width: 640, height: 480 });
  assert.notDeepEqual(zones.wrist_left, zones.wrist_right);
  assert.equal(zones.wrist_left.x, (1 - pose[15].x) * 640);
  assert.equal(zones.wrist_right.x, (1 - pose[16].x) * 640);
  const leftShoulderDistance = Math.hypot(zones.heart.x - zones.shoulder_left.x, zones.heart.y - zones.shoulder_left.y);
  const rightShoulderDistance = Math.hypot(zones.heart.x - zones.shoulder_right.x, zones.heart.y - zones.shoulder_right.y);
  assert.ok(leftShoulderDistance < rightShoulderDistance);
});

test("low visibility landmarks do not create selectable joints", () => {
  const pose = landmarks(33);
  Object.assign(pose[11], { x: 0.3, y: 0.3 });
  Object.assign(pose[12], { x: 0.7, y: 0.3 });
  Object.assign(pose[15], { x: 0.1, y: 0.5, visibility: 0.1 });
  const zones = computeZones({ poseLandmarks: pose, width: 640, height: 480 });
  assert.equal(zones.wrist_left, undefined);
  assert.ok(zones.wrist_right);
});

test("specific priority wins overlap before normalized distance", () => {
  const zones = {
    broad: { x: 0, y: 0, r: 100, priority: 40 },
    specific: { x: 40, y: 0, r: 50, priority: 10 },
  };
  assert.equal(selectZone({ x: 0, y: 0 }, zones), "specific");
  assert.equal(selectZone({ x: 111, y: 0 }, { old: { x: 0, y: 0, r: 100, priority: 10 } }, "old"), "old");
});

test("pointer accepts a naturally extended index without requiring tightly folded fingers", () => {
  const hand = landmarks(21);
  Object.assign(hand[0], { x: 0.5, y: 0.82 });
  Object.assign(hand[5], { x: 0.45, y: 0.68 });
  Object.assign(hand[6], { x: 0.45, y: 0.54 });
  Object.assign(hand[7], { x: 0.45, y: 0.38 });
  Object.assign(hand[8], { x: 0.45, y: 0.2 });
  for (const [mcp, pip, tip] of [[9, 10, 12], [13, 14, 16], [17, 18, 20]]) {
    Object.assign(hand[mcp], { x: 0.52, y: 0.66 });
    Object.assign(hand[pip], { x: 0.53, y: 0.54 });
    Object.assign(hand[tip], { x: 0.54, y: 0.7 });
  }
  assert.ok(pointingTip(hand, 640, 480));

  for (const tip of [12, 16, 20]) Object.assign(hand[tip], { x: 0.54, y: 0.3 });
  assert.ok(pointingTip(hand, 640, 480));
  assert.deepEqual(indexTip(hand, 640, 480), { x: 352, y: 96 });

  Object.assign(hand[8], { x: 0.58, y: 0.55 });
  assert.equal(pointingTip(hand, 640, 480), null);
});
