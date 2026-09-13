import assert from "node:assert/strict";
import test from "node:test";

import { DwellController } from "../src/interaction.js";

test("dwell uses elapsed time and emits a selection once", () => {
  const dwell = new DwellController({ dwellMs: 1000, graceMs: 100, releaseMs: 180 });
  assert.deepEqual(dwell.update("head", 0, true), { candidate: "head", progress: 0, selected: null });
  assert.equal(dwell.update("head", 500, true).progress, 0.5);
  assert.equal(dwell.update("head", 1000, true).selected, "head");
  assert.equal(dwell.update("head", 2000, true).selected, null);
});

test("short tracking loss preserves candidate but does not add hidden time", () => {
  const dwell = new DwellController({ dwellMs: 1000, graceMs: 100 });
  dwell.update("head", 0, true);
  dwell.update("head", 400, true);
  assert.equal(dwell.update(null, 450, true).progress, 0.4);
  assert.equal(dwell.update(null, 550, true).progress, 0);
});

test("tab pause disables and resets active dwell", () => {
  const dwell = new DwellController({ dwellMs: 1000 });
  dwell.update("head", 0, true);
  dwell.update("head", 800, true);
  assert.equal(dwell.update(null, 5000, false).progress, 0);
  assert.equal(dwell.update("head", 5100, true).progress, 0);
});

test("reset blocks immediate selection until pointer leaves the old target", () => {
  const dwell = new DwellController({ dwellMs: 100, releaseMs: 50 });
  dwell.reset(2, "head");
  assert.equal(dwell.update("head", 0, true).candidate, null);
  dwell.update(null, 10, true);
  dwell.update(null, 61, true);
  assert.equal(dwell.update("head", 70, true).candidate, "head");
  assert.equal(dwell.update("head", 170, true).selected, "head");
});
