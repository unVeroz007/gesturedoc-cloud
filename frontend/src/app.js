import {
  computeZones,
  HAND_SEGMENTS,
  indexTip,
  POSE_SEGMENTS,
  selectZone,
  smoothPoint,
  toCanvas,
} from "./geometry.js?v=20260914.5";
import { DwellController } from "./interaction.js?v=20260914.5";

const PROTOCOL_VERSION = 1;
const FRONTEND_BUILD = "2026.09.14.5";
const TASKS_VERSION = "1.0.1";
const PACKAGE_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}`;
const WASM_ROOT = `${PACKAGE_ROOT}/wasm`;
const MODEL_PATHS = {
  hand: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
};
const HAND_MAX_AGE_MS = 260;
const AUX_MAX_AGE_MS = 900;
const HAND_INTERVAL_MS = 100;
const AUX_INTERVAL_MS = 260;
const SELECTION_NOTICE_MS = 2500;
const instanceId = globalThis.crypto?.randomUUID?.() || `instance-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const dwell = new DwellController({ dwellMs: 1000, graceMs: 100, releaseMs: 180 });

const elements = {
  shell: document.querySelector(".camera-shell"),
  start: document.querySelector("#start-camera"),
  stop: document.querySelector("#stop-camera"),
  retry: document.querySelector("#retry-camera"),
  status: document.querySelector("#camera-status"),
  statusDetail: document.querySelector("#status-detail"),
  stage: document.querySelector("#camera-stage"),
  video: document.querySelector("#camera-video"),
  canvas: document.querySelector("#camera-canvas"),
  progress: document.querySelector("#dwell-progress"),
  progressLabel: document.querySelector("#progress-label"),
};
const context = elements.canvas.getContext("2d", { alpha: false });

let args = {
  frontend_build: FRONTEND_BUILD,
  protocol_version: PROTOCOL_VERSION,
  reset_revision: 0,
  selected_zone_id: null,
  request_status: "idle",
  interaction_enabled: true,
  catalog: [],
};
let catalog = new Map();
let eventId = 0;
let readyRevision = null;
let stream = null;
let visionModels = null;
let animationId = null;
let cameraGeneration = 0;
let lastHandAt = -Infinity;
let lastPoseAt = -Infinity;
let lastFaceAt = -Infinity;
let latest = { timestamp: -Infinity, handLandmarks: null, poseLandmarks: null, faceLandmarks: null, poseTimestamp: -Infinity, faceTimestamp: -Infinity };
let zones = {};
let pointer = null;
let hoverZoneId = null;
let localSelectedZoneId = null;
let cameraState = "idle";
let selectionNoticeUntil = -Infinity;
let lastFrameHeight = 0;

function postToStreamlit(type, payload = {}) {
  window.parent.postMessage({ isStreamlitMessage: true, type, ...payload }, "*");
}

function sendComponentEvent(type, zoneId = null) {
  eventId += 1;
  postToStreamlit("streamlit:setComponentValue", {
    value: {
      protocol_version: PROTOCOL_VERSION,
      component_instance_id: instanceId,
      event_id: eventId,
      reset_revision: args.reset_revision,
      type,
      zone_id: zoneId,
    },
  });
}

function sendReadyIfNeeded() {
  if (readyRevision === args.reset_revision) return;
  readyRevision = args.reset_revision;
  sendComponentEvent("ready");
}

function updateHeight() {
  const height = Math.ceil(elements.shell.getBoundingClientRect().height + 4);
  if (height === lastFrameHeight) return;
  lastFrameHeight = height;
  postToStreamlit("streamlit:setFrameHeight", { height });
}

function setStatus(message, detail = "", state = cameraState) {
  cameraState = state;
  elements.status.textContent = message;
  elements.status.dataset.state = state;
  elements.statusDetail.textContent = detail;
  elements.retry.hidden = state !== "error";
  elements.start.disabled = !["idle", "stopped", "error"].includes(state);
  elements.stop.disabled = !["requesting", "loading", "running"].includes(state);
  updateHeight();
}

function labelFor(zoneId) {
  return catalog.get(zoneId)?.label || zoneId || "";
}

function syncArgs(nextArgs) {
  const previousRevision = args.reset_revision;
  const previousSelected = localSelectedZoneId || args.selected_zone_id;
  args = { ...args, ...(nextArgs || {}) };
  catalog = new Map((Array.isArray(args.catalog) ? args.catalog : []).map(zone => [zone.zone_id, zone]));
  if (args.frontend_build !== FRONTEND_BUILD) {
    setStatus("Versi kamera belum diperbarui", "Muat ulang halaman agar komponen terbaru digunakan.", "error");
    return;
  }
  if (args.protocol_version !== PROTOCOL_VERSION) {
    setStatus("Versi komponen tidak cocok", "Muat ulang aplikasi atau hubungi pengelola.", "error");
    return;
  }
  if (previousRevision !== args.reset_revision) {
    dwell.reset(args.reset_revision, previousSelected);
    hoverZoneId = null;
    localSelectedZoneId = null;
    selectionNoticeUntil = -Infinity;
    updateProgress(null, 0);
  }
  if (args.selected_zone_id !== undefined) localSelectedZoneId = args.selected_zone_id;
  if (cameraState === "running" && args.selected_zone_id) {
    const ready = args.request_status === "ready";
    setStatus(
      ready ? `Hasil siap: ${labelFor(args.selected_zone_id)}` : `Area dipilih: ${labelFor(args.selected_zone_id)}`,
      ready ? "Lihat panel hasil analisis edukatif di samping atau di bawah kamera." : "Menyiapkan informasi kesehatan…",
      "running",
    );
  }
  sendReadyIfNeeded();
}

window.addEventListener("message", event => {
  if (event.source !== window.parent || !event.data || event.data.type !== "streamlit:render") return;
  syncArgs(event.data.args);
});

function stopResources(finalState = "stopped", message = "Kamera berhenti") {
  cameraGeneration += 1;
  if (animationId !== null) cancelAnimationFrame(animationId);
  animationId = null;
  if (visionModels) {
    Object.values(visionModels).forEach(model => {
      try { model?.close?.(); } catch { /* Best-effort release for a third-party WASM resource. */ }
    });
  }
  visionModels = null;
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  elements.video.srcObject = null;
  elements.stage.hidden = true;
  latest = { timestamp: -Infinity, handLandmarks: null, poseLandmarks: null, faceLandmarks: null, poseTimestamp: -Infinity, faceTimestamp: -Infinity };
  lastHandAt = -Infinity;
  lastPoseAt = -Infinity;
  lastFaceAt = -Infinity;
  zones = {};
  pointer = null;
  hoverZoneId = null;
  selectionNoticeUntil = -Infinity;
  updateProgress(null, 0);
  dwell.reset(args.reset_revision, localSelectedZoneId);
  setStatus(message, "Pilihan manual tetap dapat digunakan.", finalState);
}

async function initializeVision(generation) {
  const vision = await import(`${PACKAGE_ROOT}/vision_bundle.mjs`);
  const ensureCurrent = () => {
    if (generation !== cameraGeneration) throw new DOMException("Camera stopped", "AbortError");
  };
  ensureCurrent();
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
  ensureCurrent();
  const created = {};
  try {
    setStatus("Memuat model visi…", "Memuat model tangan…", "loading");
    created.hand = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATHS.hand, delegate: "CPU" },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.35,
      minHandPresenceConfidence: 0.35,
      minTrackingConfidence: 0.35,
    });
    ensureCurrent();
    setStatus("Memuat model visi…", "Memuat model tubuh…", "loading");
    created.pose = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATHS.pose, delegate: "CPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
      outputSegmentationMasks: false,
    });
    ensureCurrent();
    setStatus("Memuat model visi…", "Memuat model wajah…", "loading");
    created.face = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATHS.face, delegate: "CPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: 0.45,
      minFacePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
    ensureCurrent();
    visionModels = created;
  } catch (error) {
    Object.values(created).forEach(model => {
      try { model?.close?.(); } catch { /* Best-effort release for partial initialization. */ }
    });
    throw error;
  }
}

function firstLandmarks(result, property = "landmarks") {
  const groups = result?.[property];
  return Array.isArray(groups) && Array.isArray(groups[0]) ? groups[0] : null;
}

function runInference(now) {
  if (!visionModels || elements.video.readyState < 2) return;
  if (now - lastHandAt >= HAND_INTERVAL_MS) {
    const detectedHand = firstLandmarks(visionModels.hand.detectForVideo(elements.video, now));
    if (detectedHand) {
      latest.handLandmarks = detectedHand;
      latest.timestamp = now;
    }
    lastHandAt = now;
  }
  const poseDue = now - lastPoseAt >= AUX_INTERVAL_MS;
  const faceDue = now - lastFaceAt >= AUX_INTERVAL_MS;
  if (poseDue && (!faceDue || lastPoseAt <= lastFaceAt)) {
    const detectedPose = firstLandmarks(visionModels.pose.detectForVideo(elements.video, now));
    if (detectedPose) {
      latest.poseLandmarks = detectedPose;
      latest.poseTimestamp = now;
    }
    lastPoseAt = now;
  } else if (faceDue) {
    const detectedFace = firstLandmarks(visionModels.face.detectForVideo(elements.video, now), "faceLandmarks");
    if (detectedFace) {
      latest.faceLandmarks = detectedFace;
      latest.faceTimestamp = now;
    }
    lastFaceAt = now;
  }
}

function cameraErrorMessage(error) {
  const name = error?.name || "CameraError";
  if (["NotAllowedError", "PermissionDeniedError"].includes(name)) return "Izin kamera ditolak. Ubah izin kamera pada browser, lalu coba lagi.";
  if (["NotFoundError", "DevicesNotFoundError"].includes(name)) return "Kamera tidak ditemukan pada perangkat ini.";
  if (["NotReadableError", "TrackStartError"].includes(name)) return "Kamera sedang dipakai aplikasi lain atau tidak dapat dibaca.";
  if (name === "OverconstrainedError") return "Kamera tidak mendukung pengaturan yang diminta.";
  return "Kamera atau model visi tidak dapat dimulai.";
}

function waitForVideo(generation) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new DOMException("Video metadata timeout", "TimeoutError")), 10000);
    elements.video.onloadedmetadata = () => {
      clearTimeout(timeoutId);
      if (generation !== cameraGeneration) reject(new DOMException("Camera stopped", "AbortError"));
      else resolve();
    };
    elements.video.onerror = () => {
      clearTimeout(timeoutId);
      reject(new DOMException("Video element failed", "NotReadableError"));
    };
  });
}

async function startCamera() {
  if (!["idle", "stopped", "error"].includes(cameraState)) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Kamera tidak tersedia", "Gunakan HTTPS atau localhost, atau pilih area secara manual.", "error");
    return;
  }
  const generation = ++cameraGeneration;
  setStatus("Menunggu izin kamera…", "Browser akan meminta izin. Anda dapat memilih area manual tanpa kamera.", "requesting");
  const pendingNotice = setTimeout(() => {
    if (generation === cameraGeneration && cameraState === "requesting") {
      setStatus("Masih menunggu izin kamera…", "Jawab permintaan izin browser atau tekan Stop.", "requesting");
    }
  }, 12000);
  try {
    const acquired = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: "user" },
      audio: false,
    });
    clearTimeout(pendingNotice);
    if (generation !== cameraGeneration) {
      acquired.getTracks().forEach(track => track.stop());
      return;
    }
    stream = acquired;
    stream.getVideoTracks().forEach(track => track.addEventListener("ended", () => {
      if (generation === cameraGeneration) stopResources("error", "Kamera terputus");
    }, { once: true }));
    elements.video.srcObject = stream;
    await waitForVideo(generation);
    await elements.video.play();
    if (generation !== cameraGeneration) return;
    elements.canvas.width = elements.video.videoWidth || 640;
    elements.canvas.height = elements.video.videoHeight || 480;
    elements.stage.hidden = false;
    setStatus("Memuat model visi…", "Unduhan pertama dapat memerlukan beberapa detik.", "loading");
    await initializeVision(generation);
    if (generation !== cameraGeneration) return;
    setStatus("Kamera aktif", "Arahkan ujung telunjuk dan tahan pada titik area sekitar satu detik.", "running");
    animationId = requestAnimationFrame(() => renderLoop(generation));
  } catch (error) {
    clearTimeout(pendingNotice);
    if (generation !== cameraGeneration || error?.name === "AbortError") return;
    const detail = cameraErrorMessage(error);
    stopResources("error", "Kamera belum dapat digunakan");
    setStatus("Kamera belum dapat digunakan", detail, "error");
  }
}

function updateProgress(zoneId, progress, guidance = null) {
  elements.progress.value = Math.round(progress * 100);
  elements.progressLabel.textContent = zoneId
    ? `${labelFor(zoneId)} — ${Math.round(progress * 100)}%`
    : guidance || "Arahkan telunjuk ke titik area tubuh";
}

function drawVideo(width, height) {
  context.save();
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(elements.video, 0, 0, width, height);
  context.restore();
  const gradient = context.createLinearGradient(0, 0, 0, 80);
  gradient.addColorStop(0, "rgba(5,10,24,.75)");
  gradient.addColorStop(1, "rgba(5,10,24,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, 80);
}

function drawConnections(landmarks, segments, width, height, color, lineWidth, minimumVisibility = 0.45) {
  if (!landmarks) return;
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  for (const [a, b] of segments) {
    const start = toCanvas(landmarks[a], width, height, true, minimumVisibility);
    const end = toCanvas(landmarks[b], width, height, true, minimumVisibility);
    if (!start || !end) continue;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
}

function drawHand(landmarks, width, height) {
  if (!landmarks) return;
  drawConnections(landmarks, HAND_SEGMENTS, width, height, "rgba(93,224,184,.82)", 3, 0);
  context.fillStyle = "rgba(93,224,184,.95)";
  for (const landmark of landmarks) {
    const visible = toCanvas(landmark, width, height, true, 0);
    if (!visible) continue;
    context.beginPath();
    context.arc(visible.x, visible.y, 3, 0, Math.PI * 2);
    context.fill();
  }
}

function colorFor(zoneId) {
  const source = catalog.get(zoneId)?.source;
  if (zoneId === "heart") return [255, 112, 132];
  return source === "face" ? [93, 224, 184] : [98, 214, 255];
}

function drawZones() {
  for (const [zoneId, area] of Object.entries(zones)) {
    const [r, g, b] = colorFor(zoneId);
    const active = zoneId === localSelectedZoneId;
    const hovered = zoneId === hoverZoneId;
    context.beginPath();
    context.arc(area.x, area.y, active || hovered ? area.r : 9, 0, Math.PI * 2);
    context.fillStyle = `rgba(${r},${g},${b},${active ? .24 : hovered ? .15 : .3})`;
    context.fill();
    context.strokeStyle = `rgba(${r},${g},${b},${active || hovered ? 1 : .92})`;
    context.lineWidth = active ? 3 : 2;
    context.stroke();
    if (!active && !hovered) {
      context.beginPath();
      context.arc(area.x, area.y, 3.5, 0, Math.PI * 2);
      context.fillStyle = `rgb(${r},${g},${b})`;
      context.fill();
    }
    if (active || hovered) {
      const label = labelFor(zoneId);
      context.font = "600 12px system-ui, sans-serif";
      const width = context.measureText(label).width;
      context.fillStyle = "rgba(5,10,24,.82)";
      context.fillRect(area.x - width / 2 - 5, area.y - area.r - 23, width + 10, 18);
      context.fillStyle = `rgb(${r},${g},${b})`;
      context.fillText(label, area.x - width / 2, area.y - area.r - 10);
    }
  }
}

function drawPointer() {
  if (!pointer) return;
  const [r, g, b] = hoverZoneId ? colorFor(hoverZoneId) : [93, 224, 184];
  context.beginPath();
  context.arc(pointer.x, pointer.y, 14, 0, Math.PI * 2);
  context.fillStyle = `rgba(${r},${g},${b},.95)`;
  context.fill();
  context.beginPath();
  context.arc(pointer.x, pointer.y, 21, 0, Math.PI * 2);
  context.strokeStyle = "rgba(255,255,255,.95)";
  context.lineWidth = 3;
  context.stroke();
  context.strokeStyle = "rgba(255,255,255,.72)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(pointer.x - 29, pointer.y);
  context.lineTo(pointer.x - 20, pointer.y);
  context.moveTo(pointer.x + 20, pointer.y);
  context.lineTo(pointer.x + 29, pointer.y);
  context.moveTo(pointer.x, pointer.y - 29);
  context.lineTo(pointer.x, pointer.y - 20);
  context.moveTo(pointer.x, pointer.y + 20);
  context.lineTo(pointer.x, pointer.y + 29);
  context.stroke();
}

function renderLoop(generation) {
  if (generation !== cameraGeneration || !stream) return;
  const now = performance.now();
  if (document.visibilityState !== "visible") {
    dwell.update(null, now, false);
    updateProgress(null, 0);
  } else {
    try {
      runInference(now);
    } catch (error) {
      console.error("[GestureDoc] inference_failed", error);
      stopResources("error", "Pemrosesan kamera terganggu");
      return;
    }
  }
  const width = elements.canvas.width;
  const height = elements.canvas.height;
  if (elements.video.readyState >= 2) drawVideo(width, height);

  const pose = now - latest.poseTimestamp <= AUX_MAX_AGE_MS ? latest.poseLandmarks : null;
  const face = now - latest.faceTimestamp <= AUX_MAX_AGE_MS ? latest.faceLandmarks : null;
  const hand = now - latest.timestamp <= HAND_MAX_AGE_MS ? latest.handLandmarks : null;
  zones = computeZones({ poseLandmarks: pose, faceLandmarks: face, width, height, mirror: true });
  const rawPointer = indexTip(hand, width, height, true);
  pointer = rawPointer ? smoothPoint(pointer, rawPointer) : null;
  const detected = selectZone(pointer, zones, hoverZoneId);
  const interaction = dwell.update(detected, now, Boolean(args.interaction_enabled) && document.visibilityState === "visible");
  hoverZoneId = interaction.candidate;
  if (interaction.selected) {
    localSelectedZoneId = interaction.selected;
    selectionNoticeUntil = now + SELECTION_NOTICE_MS;
    setStatus(
      `Area dipilih: ${labelFor(interaction.selected)}`,
      "Menyiapkan hasil analisis edukatif…",
      "running",
    );
    sendComponentEvent("zone_selected", interaction.selected);
  }
  drawConnections(pose, POSE_SEGMENTS, width, height, "rgba(98,214,255,.42)", 2, 0.3);
  drawHand(hand, width, height);
  drawZones();
  drawPointer();
  let guidance = "Ujung telunjuk terdeteksi — arahkan ke salah satu titik bercahaya";
  if (!hand) guidance = "Tangan belum terlihat — dekatkan tangan dan pastikan pencahayaan cukup";
  else if (!rawPointer) guidance = "Tangan terdeteksi — pastikan ujung telunjuk terlihat jelas";
  else if (Object.keys(zones).length === 0) guidance = "Telunjuk terdeteksi — pastikan wajah atau tubuh juga terlihat";
  if (now < selectionNoticeUntil && localSelectedZoneId) {
    updateProgress(localSelectedZoneId, 1, `Terpilih: ${labelFor(localSelectedZoneId)}`);
  } else {
    updateProgress(hoverZoneId, interaction.progress, guidance);
  }
  animationId = requestAnimationFrame(() => renderLoop(generation));
}

elements.start.addEventListener("click", startCamera);
elements.retry.addEventListener("click", startCamera);
elements.stop.addEventListener("click", () => stopResources());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    dwell.update(null, performance.now(), false);
    updateProgress(null, 0);
  }
});
window.addEventListener("pagehide", () => stopResources("stopped", "Kamera berhenti"), { once: true });
new ResizeObserver(updateHeight).observe(elements.shell);

postToStreamlit("streamlit:componentReady", { apiVersion: 1 });
document.documentElement.dataset.frontendBuild = FRONTEND_BUILD;
setStatus("Kamera belum dimulai", "Tekan Mulai kamera atau gunakan pilihan manual pada panel informasi.", "idle");
setTimeout(() => {
  if (readyRevision === null) syncArgs(args);
}, 400);
