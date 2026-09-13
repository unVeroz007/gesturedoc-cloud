export class DwellController {
  constructor({ dwellMs = 1000, graceMs = 100, releaseMs = 180 } = {}) {
    this.dwellMs = dwellMs;
    this.graceMs = graceMs;
    this.releaseMs = releaseMs;
    this.reset(0, null);
  }

  reset(revision, previouslySelected = null) {
    this.revision = revision;
    this.candidate = null;
    this.enteredAt = null;
    this.lastValidAt = null;
    this.latchedZone = null;
    this.releaseSince = null;
    this.blockedZone = previouslySelected;
  }

  update(zoneId, now, enabled = true) {
    if (!Number.isFinite(now)) throw new TypeError("now must be finite");
    if (!enabled) {
      this.candidate = null;
      this.enteredAt = null;
      return { candidate: null, progress: 0, selected: null };
    }

    if (this.latchedZone || this.blockedZone) {
      const blocked = this.latchedZone || this.blockedZone;
      if (zoneId !== blocked) {
        if (this.releaseSince === null) this.releaseSince = now;
        if (now - this.releaseSince >= this.releaseMs) {
          this.latchedZone = null;
          this.blockedZone = null;
          this.releaseSince = null;
        }
      } else {
        this.releaseSince = null;
      }
      if (this.latchedZone || this.blockedZone) {
        return { candidate: null, progress: 0, selected: null };
      }
    }

    if (!zoneId) {
      if (this.candidate && this.lastValidAt !== null && now - this.lastValidAt <= this.graceMs) {
        return {
          candidate: this.candidate,
          progress: Math.min((this.lastValidAt - this.enteredAt) / this.dwellMs, 1),
          selected: null,
        };
      }
      this.candidate = null;
      this.enteredAt = null;
      this.lastValidAt = null;
      return { candidate: null, progress: 0, selected: null };
    }

    if (zoneId !== this.candidate) {
      this.candidate = zoneId;
      this.enteredAt = now;
      this.lastValidAt = now;
      return { candidate: zoneId, progress: 0, selected: null };
    }

    this.lastValidAt = now;
    const progress = Math.min((now - this.enteredAt) / this.dwellMs, 1);
    if (progress >= 1) {
      this.latchedZone = zoneId;
      this.candidate = null;
      this.enteredAt = null;
      return { candidate: zoneId, progress: 1, selected: zoneId };
    }
    return { candidate: zoneId, progress, selected: null };
  }
}
