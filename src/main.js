import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker
} from "@mediapipe/tasks-vision";
import "./styles.css";
import { DIGIT_STATE, getHandMetrics, getHandOrientation } from "./core/hand-metrics.ts";
import { SIGN_BANK, getSign } from "./core/sign-bank.ts";
import { buildLearnedProfile, recognizeHands } from "./core/sign-engine.ts";
import { createLibraryGames } from "./core/library-games.ts";
import { mountChainScore } from "./components/chain-score.ts";
import { createPointGestureReset } from "./components/point-gesture-reset.ts";
import "./components/chain-score.css";
import { createTargetPractice } from "./core/target-practice.ts";
import { createTargetMotion, motionStartMatches } from "./core/target-motion.ts";
import { practiceLibrary } from "./core/practice-library.ts";
import { WORD_PLACEHOLDERS } from "./core/word-library.ts";
import { createLibraryDwell, easeDwellProgress, indexLabelPosition, INDEX_LABEL_OFFSET, MIN_BUTTON_INTENT_MS } from "./core/library-navigation.ts";
import { createLearningMode, isLearningCheckpoint, isTwoThumbsUp } from "./core/learning-mode.ts";
import { motionObservationFromLandmarks } from "./core/motion-engine.ts";
import { getDistanceGuidance, handOverlapsFace } from "./core/spatial-safety.ts";
import {
  CALIBRATION_TARGETS, MIN_CALIBRATION_LUMINANCE, approximateHeadBounds,
  landmarkBounds, projectBox, meanLuminance, evaluateCameraCalibration,
  createCalibrationHold, createHeadBoxTracker
} from "./core/camera-calibration.ts";
import { numberFocusRange } from "./core/recognition-focus.ts";
import { getHandPosition, getPalmFrame, mirrorCardinalAngle, mirrorSignedHandAngle } from "./core/hand-position.ts";
import { APP_VERSION, createSessionId, PRIMARY_RESEARCHER_ID } from "./core/research-profile.ts";
import {
  addExample,
  clearSignTraining,
  exportTrainingData,
  getAllProfiles,
  getExamples,
  importTrainingData,
  saveProfile
} from "./core/training-store.ts";

const video = document.querySelector("#webcam");
const canvas = document.querySelector("#tracking-canvas");
const context = canvas.getContext("2d");
const startButton = document.querySelector("#start-button");
const instruction = document.querySelector("#instruction");
const status = document.querySelector("#status");
const statusCopy = document.querySelector("#status-copy");
const fpsCopy = document.querySelector("#fps");
const handCountCopy = document.querySelector("#hand-count");
const handPositionIcons = document.querySelector("#hand-position-icons");
const initializationGate = document.querySelector("#initialization-gate");
const framingGuidance = document.querySelector("#framing-guidance");
const framingProgressBar = document.querySelector("#framing-progress-bar");
const trackedHeadBox = document.querySelector("#tracked-head-box");
const lightingWarning = document.querySelector("#lighting-warning");
const stage = document.querySelector(".stage");
const learningModeBanner = document.querySelector("#learning-mode-banner");
const learningModeCopy = document.querySelector("#learning-mode-copy");
const learningModeFlash = document.querySelector("#learning-mode-flash");
const distanceAlert = document.querySelector("#distance-alert");
const gestureList = document.querySelector("#gesture-list");
const libraryTabs = [...document.querySelectorAll("[data-library]")];
const libraryButtonGroup = document.querySelector(".library-tabs");
const libraryTitle = document.querySelector("#library-title");
const libraryCount = document.querySelector("#library-count");
const gestureResponse = document.querySelector("#gesture-response");
const responseImage = document.querySelector("#response-image");
const chainReward = document.querySelector("#chain-reward");
const chainRewardCopy = document.querySelector("#chain-reward-copy");
const chainFailure = document.querySelector("#chain-failure");
const chainFailureCopy = document.querySelector("#chain-failure-copy");
const recognitionModeCopy = document.querySelector("#recognition-mode-copy");
const motionReadout = document.querySelector("#motion-readout");
const motionLabelCopy = document.querySelector("#motion-label");
const motionPhaseCopy = document.querySelector("#motion-phase");
const motionDistanceCopy = document.querySelector("#motion-distance");
const motionProgressBar = document.querySelector("#motion-progress");
const diagnosticsToggle = document.querySelector("#diagnostics-toggle");
const diagnosticsPanel = document.querySelector("#diagnostics-panel");
const diagnosticsClose = document.querySelector("#diagnostics-close");
const diagnosticsBody = document.querySelector("#diagnostics-body");
const recognitionDiagnostic = document.querySelector("#recognition-diagnostic");
const recordingStatus = document.querySelector("#recording-status");
const recordingProgressBar = document.querySelector("#recording-progress-bar");
const calibrationReport = document.querySelector("#calibration-report");
const clearCalibrationButton = document.querySelector("#clear-calibration");
const calibrationSignSelect = document.querySelector("#calibration-sign");
const exportTrainingButton = document.querySelector("#export-training");
const importTrainingInput = document.querySelector("#import-training");
const startGuidedTrainingButton = document.querySelector("#start-guided-training");
const captureFalseMatchButton = document.querySelector("#capture-false-match");
const guidedTrainingPanel = document.querySelector("#guided-training");
const guidedStepCopy = document.querySelector("#guided-step");
const guidedKindCopy = document.querySelector("#guided-kind");
const guidedStepProgressBar = document.querySelector("#guided-step-progress-bar");
const guidedTitle = document.querySelector("#guided-title");
const guidedInstruction = document.querySelector("#guided-instruction");
const guidedCaptureButton = document.querySelector("#guided-capture");
const guidedStopButton = document.querySelector("#guided-stop");

const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4], [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12], [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20], [0,17]
];

let handLandmarker;
let faceLandmarker;
let stream;
let lastVideoTime = -1;
let frameCount = 0;
let fpsStartedAt = performance.now();
let lastDetectedHands = [];
let audioContext;
let responseTimer;
let rewardTimer;
let failureTimer;
let delayedFailureTimer;
let learningActivationHistory = [];
let learningActivationArmed = true;
let learningPromptTimer;
let recentLearningFrames = [];
let lastFaceCheckAt = 0;
let faceLandmarks = [];
let lastLightingCheckAt = -Infinity;
let lightingLevel = 0;
let lightingIsLow = true;
const lightingCanvas = document.createElement("canvas");
lightingCanvas.width = 96;
lightingCanvas.height = 54;
const lightingContext = lightingCanvas.getContext("2d", { willReadFrequently: true });
const framingHold = createCalibrationHold();
const headBoxTracker = createHeadBoxTracker(500);
let lastDistanceCheckAt = 0;
let distanceAlertTimer;
let recordingSession = null;
let selectedExamples = [];
let guidedSession = null;
let isInitialized = false;
let lastHandPositionUpdateAt = 0;
const learnedProfiles = new Map();
const researchSessionId = createSessionId();
const libraryGames = createLibraryGames();
const chainGame = libraryGames.get("number", 20);
const practice = createTargetPractice();
let targetMotion = null;
let currentPracticeKey = null;
let staticAnchors = null;
let practiceFeedbackUntil = 0;
let lastPracticeFrameAt = null;
let learningFinishTimer;
const learningMode = createLearningMode(20, 5);
const HAND_POSITION_UPDATE_MS = 500;
const libraryDwell = createLibraryDwell();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let activeLibrary = "number";
let librarySwitching = false;
let libraryFillTimer;
let libraryFlashTimer;
let manualSelectionTimer;
let isLibraryNavigationActive = false;
const chainScore = mountChainScore(document.querySelector("#chain-score"), resetGameProgress);
const pointGestureReset = createPointGestureReset(document.querySelector(".experiment"));
// Wrapped selector rows keep their neighbouring diagnostic control below them.
const selectorLayout = new ResizeObserver(() => {
  stage.style.setProperty("--selector-height", `${libraryButtonGroup.offsetHeight}px`);
});
selectorLayout.observe(libraryButtonGroup);

function selectedLibraryGame() {
  const count = practiceLibrary(SIGN_BANK).filter(entry => entry.category === activeLibrary).length;
  return libraryGames.get(activeLibrary, count);
}

function clearCountdownDisplay() {
  document.querySelectorAll("#gesture-list li.is-timed").forEach((item) => {
    item.classList.remove("is-timed", "is-timer-bonus");
    item.style.removeProperty("--timer-progress");
  });
}

function resetPracticeTarget() {
  currentPracticeKey = null;
  targetMotion = null;
  staticAnchors = null;
  lastPracticeFrameAt = null;
  practice.reset();
  clearCountdownDisplay();
}

function showLearningPrompt(number, delay = 0) {
  clearTimeout(learningPromptTimer);
  learningPromptTimer = setTimeout(() => {
    recentLearningFrames = [];
    const sign = getSign(`bsl-number-${number}`);
    if (!sign) return;
    clearTimeout(responseTimer);
    responseImage.src = sign.promptAsset;
    responseImage.alt = `Learn BSL ${sign.label}`;
    responseImage.classList.toggle("is-inverted", sign.id === "bsl-number-6");
    gestureResponse.classList.remove("is-pinging", "is-learning-close");
    gestureResponse.classList.add("is-learning-prompt");
    gestureResponse.setAttribute("aria-hidden", "false");
  }, delay);
}

function setLearningPromptProximity(isClose) {
  if (!learningMode.getState().active) return;
  gestureResponse.classList.toggle("is-learning-close", isClose);
}

async function saveLearningEvidence(sign) {
  if (lightingIsLow || !isInitialized || sign.hands !== 1 || recentLearningFrames.length < 8) return;
  const evidence = recentLearningFrames.slice(-12);
  const example = {
    signId: sign.id,
    kind: "positive",
    recordedAt: new Date().toISOString(),
    frames: evidence.map((frame) => frame.metrics),
    landmarkFrames: evidence.map((frame) => frame.landmarks),
    evidenceFormat: "hand-landmarks-and-metrics-v1",
    containsVideo: false,
    containsAudio: false,
    researcherId: PRIMARY_RESEARCHER_ID,
    sessionId: researchSessionId,
    appVersion: APP_VERSION,
    handedness: "unknown",
    protocolStepId: "game-learning-mode"
  };
  try {
    await addExample(example);
    if (sign.recognitionType === "static") {
      const profile = buildLearnedProfile(sign.id, await getExamples(sign.id));
      if (profile) {
        await saveProfile(profile);
        learnedProfiles.set(sign.id, profile);
      }
    }
  } catch (error) {
    console.error("Unable to save learning-mode evidence", error);
  }
}

function startLearningMode() {
  const state = learningMode.start(chainGame.getState().progress);
  if (!state.active || state.expected === null) return;
  clearCountdownDisplay();
  clearStaticGestureCandidate();
  resetPracticeTarget();
  learningActivationHistory = [];
  learningActivationArmed = false;
  recentLearningFrames = [];
  learningModeBanner.hidden = false;
  learningModeFlash.classList.remove("is-flashing");
  void learningModeFlash.offsetWidth;
  learningModeFlash.classList.add("is-flashing");
  learningModeCopy.textContent = `Learn numbers ${state.checkpoint + 1} to ${state.checkpoint + 5}`;
  recognitionModeCopy.textContent = "Learning mode";
  showLearningPrompt(state.expected);
}

function updateDistanceAlert(hands, now, viewport) {
  if (!isInitialized || lightingIsLow) return;
  if (now - lastDistanceCheckAt < 3000) return;
  lastDistanceCheckAt = now;
  const guidance = getDistanceGuidance(hands, {}, viewport);
  if (!guidance) return;
  clearTimeout(distanceAlertTimer);
  distanceAlert.textContent = guidance === "move-back" ? "Move back" : "Move closer";
  distanceAlert.setAttribute("aria-hidden", "false");
  distanceAlert.classList.remove("is-showing");
  void distanceAlert.offsetWidth;
  distanceAlert.classList.add("is-showing");
  distanceAlertTimer = setTimeout(() => {
    distanceAlert.classList.remove("is-showing");
    distanceAlert.setAttribute("aria-hidden", "true");
  }, 2000);
}

function finishLearningMode(state) {
  learningModeBanner.hidden = true;
  gestureResponse.classList.remove("is-learning-prompt", "is-learning-close", "is-pinging");
  gestureResponse.setAttribute("aria-hidden", "true");
  learningActivationHistory = [];
  recentLearningFrames = [];
  clearStaticGestureCandidate();
  resetPracticeTarget();
  renderChainState(chainGame.getState());
  prepareNextTarget(chainGame.getState());
  setStatus(`Learning complete. Checkpoint ${state.checkpoint} secured`, "is-live");
}

function updateLearningActivation(handMetrics) {
  if (activeLibrary !== "number" || librarySwitching || isLibraryNavigationActive) return;
  const canStart = !learningMode.getState().active && isLearningCheckpoint(chainGame.getState().progress);
  const poseMatches = isTwoThumbsUp(handMetrics);
  if (!poseMatches) learningActivationArmed = true;
  learningActivationHistory.push(canStart && learningActivationArmed && poseMatches);
  if (learningActivationHistory.length > 12) learningActivationHistory.shift();
  const confirmed = learningActivationHistory.length === 12
    && learningActivationHistory.filter(Boolean).length >= 10;
  if (confirmed) startLearningMode();
}

function prepareNextTarget() {
  // A new target starts in preparation, never with an already-running deadline.
  resetPracticeTarget();
}

const FINGERTIPS = new Set([4, 8, 12, 16, 20]);
const FINGER_LABELS = [
  { label: "T", tip: 4 },
  { label: "I", tip: 8 },
  { label: "M", tip: 12 },
  { label: "R", tip: 16 },
  { label: "P", tip: 20 }
];

function setStatus(message, mode = "") {
  statusCopy.textContent = message;
  status.className = `status ${mode}`.trim();
}

function handednessName(result, index) {
  const category = (result.handedness || result.handednesses || [])[index]?.[0];
  return category?.categoryName || category?.displayName || "Unknown";
}

function updateHandPositionIndicators(result, now) {
  if (!isInitialized || now - lastHandPositionUpdateAt < HAND_POSITION_UPDATE_MS) return;
  lastHandPositionUpdateAt = now;
  const readings = (result.landmarks || []).map((landmarks, index) => {
    const reading = getHandPosition(landmarks, handednessName(result, index));
    return {
      ...reading,
      angle: mirrorCardinalAngle(reading.angle),
      screenX: 1 - landmarks[0].x
    };
  }).sort((a, b) => a.screenX - b.screenX);

  handPositionIcons.innerHTML = readings.map((reading) => {
    if (reading.facing === "unknown" || reading.confidence < 0.35) {
      return `<span class="hand-position-indicator is-unknown"><small><b>${reading.handedness}</b><span>UNKNOWN</span></small></span>`;
    }
    const asset = reading.facing === "front" ? "palm_forward.png" : "back_hand.png";
    return `<span class="hand-position-indicator">
      <img src="/BSL_diagram_overlays/hand_positions/${asset}" alt="" style="transform: rotate(${reading.angle}deg)">
      <small><b>${reading.handedness}</b><span>${reading.facing} · ${reading.angle}°</span></small>
    </span>`;
  }).join("");
}

function completeInitialization(now) {
  if (isInitialized) return;
  isInitialized = true;
  initializationGate.hidden = true;
  stage.classList.remove("is-calibrating");
  lastHandPositionUpdateAt = now - HAND_POSITION_UPDATE_MS;
  setStatus("Calibration complete. Ready to play", "is-live");
}

function placeFramingBox(element, box) {
  element.style.left = `${box.left * 100}%`;
  element.style.top = `${box.top * 100}%`;
  element.style.width = `${(box.right - box.left) * 100}%`;
  element.style.height = `${(box.bottom - box.top) * 100}%`;
}

document.querySelectorAll("[data-calibration-target]").forEach((element) => {
  placeFramingBox(element, CALIBRATION_TARGETS[element.dataset.calibrationTarget]);
});

function updateLighting(hands, now) {
  if (now - lastLightingCheckAt < 250) return;
  lastLightingCheckAt = now;
  // Read original camera pixels, not the deliberately dimmed display or screenshots.
  lightingContext.drawImage(video, 0, 0, 96, 54);
  const pixels = lightingContext.getImageData(0, 0, 96, 54).data;
  const regions = [landmarkBounds(faceLandmarks), ...hands.map(landmarkBounds)]
    .filter((box) => box && box.right > box.left && box.bottom > box.top);
  if (!regions.length) regions.push({ left: .25, top: .1, right: .75, bottom: .8 });
  lightingLevel = Math.min(...regions.map((region) => meanLuminance(pixels, 96, 54, region)));
  lightingIsLow = lightingLevel < MIN_CALIBRATION_LUMINANCE;
  lightingWarning.hidden = !lightingIsLow;
  if (lightingIsLow) {
    framingHold.reset();
    clearStaticGestureCandidate();
    targetMotion?.reset();
    recentLearningFrames = [];
    if (recordingSession) {
      stopGuidedTraining();
      recordingStatus.textContent = "Lighting too low. Unfinished capture discarded; improve the lighting and retry.";
      recordingProgressBar.style.width = "0%";
    }
  }
}

function updateCameraFraming(hands, viewport, now) {
  const rawHead = approximateHeadBounds(faceLandmarks);
  const head = rawHead ? projectBox(rawHead, viewport) : null;
  const displayBox = headBoxTracker.update(lightingIsLow ? null : head, now);
  trackedHeadBox.hidden = !displayBox;
  if (displayBox) placeFramingBox(trackedHeadBox, displayBox);
  if (isInitialized) return;
  const handBoxes = hands.map(landmarkBounds).filter(Boolean).map((box) => projectBox(box, viewport));
  const framing = evaluateCameraCalibration({ head, hands: handBoxes, luminance: lightingLevel, faceTrackerReady: !!faceLandmarker });
  const hold = framingHold.update(framing.ready, now);
  framingGuidance.textContent = framing.message;
  framingProgressBar.style.width = `${hold.progress * 100}%`;
  document.querySelectorAll("[data-calibration-target]").forEach((element) => {
    element.classList.toggle("is-ready", framing[`${element.dataset.calibrationTarget}Ready`]);
  });
  setStatus(framing.message, framing.lightingLow ? "is-error" : "");
  if (hold.complete) completeInitialization(now);
}

function clearStaticGestureCandidate() {
  document.querySelectorAll("#gesture-list li.is-active").forEach((item) => {
    if (getSign(item.dataset.signId)?.recognitionType === "static") item.classList.remove("is-active");
  });
}

function fillLibrary() {
  const entries = practiceLibrary(SIGN_BANK).filter(entry => entry.category === activeLibrary);
  const fragment = document.createDocumentFragment();
  let previousGroup = null;
  for (const [index, entry] of entries.entries()) {
    if (entry.group && entry.group !== previousGroup) {
      const groupRow = document.createElement("li");
      groupRow.className = "library-group";
      const heading = document.createElement("h3");
      entry.group.split("/").forEach((part, partIndex) => {
        if (partIndex) heading.append("/", document.createElement("wbr"));
        heading.append(part);
      });
      groupRow.append(heading);
      fragment.append(groupRow);
      previousGroup = entry.group;
    }
    const row = document.createElement("li");
    row.dataset.signId = entry.id;
    const number = document.createElement("span");
    number.className = "gesture-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("span");
    label.textContent = entry.label;
    row.append(number, label);
    if (entry.available) {
      row.dataset.gesture = getSign(entry.id).shortLabel;
      if (getSign(entry.id).motion) row.dataset.motionStatus = "active";
      row.setAttribute("role", "button");
      row.tabIndex = 0;
      row.setAttribute("aria-label", `Show help for BSL ${entry.label}`);
    } else {
      row.classList.add("is-unavailable");
      row.setAttribute("aria-disabled", "true");
      row.title = entry.reason || "Training required";
      row.setAttribute("aria-label", `${number.textContent} ${entry.label}: not trained`);
    }
    fragment.append(row);
  }
  gestureList.replaceChildren(fragment);
  gestureList.scrollTop = 0;
  librarySwitching = false;
  gestureList.setAttribute("aria-busy", "false");
  renderChainState(chainGame.getState());
}

function switchLibrary(category) {
  if (pointGestureReset.isBlocked(libraryButtonGroup)) return;
  if (!["number", "letter", "word"].includes(category)) return;
  libraryGames.activate(category);
  clearTimeout(libraryFillTimer);
  clearTimeout(learningFinishTimer);
  clearTimeout(learningPromptTimer);
  clearTimeout(responseTimer);
  clearTimeout(rewardTimer);
  clearTimeout(failureTimer);
  clearTimeout(delayedFailureTimer);
  stopGuidedTraining();
  learningMode.reset();
  learningModeBanner.hidden = true;
  learningActivationHistory = [];
  learningActivationArmed = true;
  recentLearningFrames = [];
  resetPracticeTarget();
  gestureResponse.classList.remove("is-pinging", "is-learning-prompt", "is-learning-close");
  gestureResponse.setAttribute("aria-hidden", "true");
  for (const overlay of [chainReward, chainFailure, distanceAlert]) {
    overlay.classList.remove("is-showing");
    overlay.setAttribute("aria-hidden", "true");
  }
  motionReadout.hidden = true;
  diagnosticsPanel.hidden = true;
  diagnosticsToggle.setAttribute("aria-expanded", "false");
  activeLibrary = category;
  librarySwitching = true;
  libraryTabs.forEach(tab => tab.setAttribute("aria-pressed", String(tab.dataset.library === category)));
  clearTimeout(libraryFlashTimer);
  libraryTabs.forEach(tab => tab.classList.remove("is-activation-flash"));
  const selectedTab = libraryTabs.find(tab => tab.dataset.library === category);
  void selectedTab.offsetWidth;
  selectedTab.classList.add("is-activation-flash");
  libraryFlashTimer = setTimeout(() => selectedTab.classList.remove("is-activation-flash"), 250);
  const numbers = category === "number";
  const words = category === "word";
  libraryTitle.textContent = numbers ? "BSL numbers" : words ? "BSL words" : "BSL letters";
  libraryCount.textContent = numbers ? "1–20 active" : words ? `${WORD_PLACEHOLDERS.length} placeholders` : "A–Z · Not trained";
  document.querySelector(".gesture-rail").setAttribute("aria-label", numbers ? "BSL number game" : words ? "BSL word library" : "BSL letter library");
  recognitionModeCopy.textContent = numbers ? "Preparing number library" : words ? "Word placeholders" : "Letter rules pending";
  document.querySelector(".rail-note").textContent = numbers
    ? "Only the highlighted sign is checked. Prepare at your own pace. Then hold for a static sign or complete the movement."
    : words ? `${WORD_PLACEHOLDERS.length} word placeholders for user testing. Sign recognition is not active.`
      : "A–Z library. Letter rules and diagrams still need to be added. Number recognition is paused.";
  renderChainState(chainGame.getState());
  // Clear at the dwell trigger, then allow an empty paint before repopulating.
  gestureList.replaceChildren();
  gestureList.setAttribute("aria-busy", "true");
  libraryFillTimer = setTimeout(fillLibrary, 100);
  libraryDwell.suspend(performance.now());
  pointGestureReset.begin(libraryButtonGroup);
  libraryTabs.forEach(tab => {
    tab.classList.remove("is-dwelling");
    tab.style.setProperty("--dwell-progress", 0);
  });
}

function updateLibraryNavigation(hands, results, viewport, now) {
  if (pointGestureReset.isBlocked(libraryButtonGroup, now)) {
    libraryDwell.suspend(now);
    isLibraryNavigationActive = true;
    return;
  }
  const stageRect = stage.getBoundingClientRect();
  const targets = libraryTabs.map(tab => {
    const r = tab.getBoundingClientRect();
    return { id: tab.dataset.library, enabled: !tab.disabled,
      left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
  const pointers = lightingIsLow || document.hidden ? [] : hands.flatMap((hand, index) => {
    // Use only fresh detections with a visible I label, never the retained skeleton.
    if (getHandMetrics(hand)[1].state !== DIGIT_STATE.EXTENDED) return [];
    const position = indexLabelPosition(hand, viewport);
    if (!position) return [];
    return [{ id: handednessName(results, index), x: stageRect.left + position.x, y: stageRect.top + position.y }];
  });
  const dwell = libraryDwell.update(now, pointers, targets);
  isLibraryNavigationActive = !!dwell.target;
  libraryTabs.forEach(tab => {
    const hovering = dwell.target === tab.dataset.library;
    tab.classList.toggle("is-dwelling", hovering);
    const visualProgress = reducedMotion.matches ? dwell.progress : easeDwellProgress(dwell.progress);
    tab.style.setProperty("--dwell-progress", hovering ? visualProgress : 0);
  });
  if (dwell.triggered) switchLibrary(dwell.triggered);
}

function requestedSign() {
  if (activeLibrary !== "number" || librarySwitching) return null;
  const learning = learningMode.getState();
  const game = chainGame.getState();
  if (!learning.active && game.complete) return null;
  return getSign(`bsl-number-${learning.active ? learning.expected : game.expected}`);
}

function movementInstruction(sign) {
  if (!sign.motion) return "Hold the sign steady";
  const { detector, cycleCount } = sign.motion;
  if (detector === "dual-pinch") return "Close thumb onto index and middle together";
  if (detector === "index-pinch") return cycleCount === 2 ? "Pinch, open, then pinch again" : "Close index and thumb in one pinch";
  return detector === "horizontal-wave" ? "Move side to side twice" : "Move up and down twice";
}

function updateTargetPractice(hands, handMetrics, orientations, now) {
  const sign = requestedSign();
  if (!sign || !isInitialized) { motionReadout.hidden = true; return; }
  const learning = learningMode.getState().active;
  const key = `${learning ? "learn" : "play"}:${sign.id}`;
  if (key !== currentPracticeKey) {
    resetPracticeTarget();
    currentPracticeKey = key;
    targetMotion = sign.motion ? createTargetMotion(sign) : null;
    practice.reset({ id: sign.id, kind: sign.motion ? "motion" : "static", policy: sign.practice });
  }
  const previous = practice.getState();
  const available = !lightingIsLow && !recordingSession && !document.hidden && !isLibraryNavigationActive
    && now >= practiceFeedbackUntil && hands.length >= sign.hands;
  const frameGap = lastPracticeFrameAt !== null && now - lastPracticeFrameAt > 300;
  lastPracticeFrameAt = now;
  if (!available || frameGap || previous.phase !== "performing") {
    targetMotion?.reset();
    staticAnchors = null;
  }
  const observations = hands.map((landmarks) => motionObservationFromLandmarks(landmarks, now));
  // Sorting spatially avoids MediaPipe result-order swaps breaking a two-hand hold.
  const ordered = [...observations].sort((a, b) => a.centerX - b.centerX);
  let steady = true;
  if (staticAnchors && ordered.length === staticAnchors.length) {
    steady = ordered.every((o, i) => {
      const a = staticAnchors[i];
      const angle = Math.abs(((o.palmAngle - a.palmAngle + 540) % 360) - 180);
      return Math.hypot(o.centerX - a.centerX, o.centerY - a.centerY) / Math.max(a.palmScale, .0001) < .2 && angle < 15;
    });
  }
  if (!staticAnchors || !steady) staticAnchors = ordered;
  const recognition = sign.recognitionType === "static"
    ? recognizeHands([sign], handMetrics, learnedProfiles, orientations) : null;
  const shapeMatches = hands.length === sign.hands && (sign.motion
    ? motionStartMatches(sign, observations[0], handMetrics[0]) : recognition?.match?.sign.id === sign.id);
  let movement = { complete: false, progress: 0 };
  if (available && !frameGap && previous.phase === "performing" && targetMotion) {
    if (hands.length === sign.hands) movement = targetMotion.update(observations[0], handMetrics[0]);
    else targetMotion.reset();
  }
  const result = practice.update({ now, available, startPose: shapeMatches && (sign.motion || steady),
    staticMatch: shapeMatches && steady, motionComplete: movement.complete, motionProgress: movement.progress });
  motionReadout.hidden = false;
  motionLabelCopy.textContent = `Target: ${sign.label}`;
  motionPhaseCopy.textContent = result.phase === "paused" ? "Paused. Restore clear hand tracking"
    : result.phase === "preparing" ? (sign.motion ? (sign.motion.detector.includes("pinch") ? "Form the starting shape with pinch fingers apart" : "Raise the required fingers before waving") : "Form the sign, then hold steady")
      : movementInstruction(sign);
  motionDistanceCopy.textContent = result.phase === "preparing" ? "Take your time. Timer starts when ready"
    : `${(result.remainingMs / 1000).toFixed(1)} seconds remaining`;
  motionProgressBar.style.width = `${Math.round(result.progress * 100)}%`;
  recognitionModeCopy.textContent = `Target only: ${sign.shortLabel}`;
  document.querySelectorAll("#gesture-list li[data-sign-id]").forEach((item) => {
    const target = item.dataset.signId === sign.id;
    item.classList.toggle("is-target", target);
    item.classList.toggle("is-active", target && result.phase === "performing");
    item.classList.toggle("is-timed", target && ["performing", "paused"].includes(result.phase));
    item.classList.toggle("is-timer-bonus", target && !!sign.motion);
    if (target) item.style.setProperty("--timer-progress", result.remainingMs / result.durationMs);
  });
  if (learning) setLearningPromptProximity(result.phase === "performing");
  if (!diagnosticsPanel.hidden) {
    if (recognition) renderRecognitionDiagnostic(recognition, orientations[0]);
    else {
      recognitionDiagnostic.textContent = `${sign.label}: ${motionPhaseCopy.textContent}. Movement ${(result.progress * 100).toFixed(0)}%`;
    }
  }
  if (result.phase === "success") {
    practiceFeedbackUntil = now + 1100;
    showGestureResponse(sign.id, true);
  } else if (result.phase === "timeout") {
    practiceFeedbackUntil = now + 1100;
    if (learning) {
      resetPracticeTarget();
      if (learning) showLearningPrompt(Number(sign.shortLabel));
      setStatus("Take your time. Try this movement again", "is-live");
    } else {
      const failure = chainGame.timeout();
      resetPracticeTarget();
      renderChainState(failure.state);
      showChainFailure(failure);
    }
  }
}

function renderDiagnostics(metrics) {
  const names = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
  diagnosticsBody.innerHTML = metrics.map((digit, index) => `
    <tr>
      <td>${names[index]}</td>
      <td><span class="digit-state ${digit.state}">${digit.state}</span></td>
      <td>${digit.angle1.toFixed(0)}°</td>
      <td>${digit.angle2.toFixed(0)}°</td>
      <td>${Math.round(digit.straightness * 100)}%</td>
      <td>${digit.reach.toFixed(2)}</td>
    </tr>
  `).join("");
}

function renderRecognitionDiagnostic(recognition, orientation) {
  if (!recognition?.results?.length) {
    recognitionDiagnostic.className = "recognition-diagnostic";
    recognitionDiagnostic.textContent = "Show a hand to inspect orientation and the selected sign's live score.";
    return;
  }

  const selectedSignId = calibrationSignSelect.value;
  const selected = recognition.results.find((candidate) => candidate.sign.id === selectedSignId);
  const top = recognition.results[0];
  const match = recognition.match;
  const selectedScore = selected ? Math.round(selected.score * 100) : 0;
  const selectedMinimum = selected ? Math.round(selected.sign.minimumScore * 100) : 0;
  const margin = Math.round(recognition.margin * 100);
  const state = match?.sign.id === selectedSignId ? "is-match" : match ? "is-other" : "is-uncertain";
  const resultCopy = match ? `Recognized ${match.sign.label}` : "No confident match";

  recognitionDiagnostic.className = `recognition-diagnostic ${state}`;
  recognitionDiagnostic.innerHTML = `
    <strong>${resultCopy}</strong>
    <span>Palm frame: ${orientation?.cardinalAngle ?? 0}° · raw ${orientation?.signedAngle?.toFixed(0) ?? "0"}° · confidence ${Math.round((orientation?.confidence ?? 1) * 100)}%</span>
    <span>Selected ${selected?.sign.label || "sign"}: ${selectedScore}% · target ${selectedMinimum}%</span>
    <span>Top candidate: ${top.sign.label} ${Math.round(top.score * 100)}% · margin ${margin}%</span>
  `;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function range(values, formatter) {
  if (!values.length) return "No data";
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return `${formatter(minimum)}–${formatter(maximum)}`;
}

function buildRangeTable(label, samples) {
  if (!samples.length) return "";
  const names = ["T", "I", "M", "R", "P"];
  const rows = names.map((name, digitIndex) => {
    const digits = samples.map((frame) => frame[digitIndex]);
    const stateCounts = digits.reduce((counts, digit) => {
      counts[digit.state] = (counts[digit.state] || 0) + 1;
      return counts;
    }, {});
    const dominantState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0];
    const stateSummary = `${dominantState[0].slice(0, 3).toUpperCase()} ${Math.round(dominantState[1] / digits.length * 100)}%`;
    return `<tr>
      <td>${name}</td>
      <td>${stateSummary}</td>
      <td>${range(digits.map((digit) => digit.angle1), (value) => `${value.toFixed(0)}°`)}</td>
      <td>${range(digits.map((digit) => digit.angle2), (value) => `${value.toFixed(0)}°`)}</td>
      <td>${range(digits.map((digit) => digit.straightness), (value) => `${Math.round(value * 100)}%`)}</td>
      <td>${range(digits.map((digit) => digit.reach), (value) => value.toFixed(2))}</td>
    </tr>`;
  }).join("");

  return `<section class="capture-ranges">
    <h3>${label} captured ranges · ${samples.length} frames</h3>
    <div class="diagnostics-table-wrap"><table>
      <thead><tr><th>Digit</th><th>State</th><th>Joint 1</th><th>Joint 2</th><th>Straight</th><th>Reach</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}

function renderCalibrationReport() {
  const sign = getSign(calibrationSignSelect.value);
  if (!sign) return;
  const positiveExamples = selectedExamples.filter((example) => example.kind === "positive");
  const negativeExamples = selectedExamples.filter((example) => example.kind === "negative");
  const positiveFrames = positiveExamples.flatMap((example) => example.frames);
  const negativeFrames = negativeExamples.flatMap((example) => example.frames);
  const profile = learnedProfiles.get(sign.id);

  if (!positiveFrames.length && !negativeFrames.length) {
    calibrationReport.innerHTML = `<strong>${sign.label}</strong><br>No training examples yet. Add five correct and three incorrect examples.`;
    return;
  }

  let comparison = "Add both correct and incorrect examples to identify discriminating features.";

  if (positiveFrames.length && negativeFrames.length) {
    const digitNames = ["thumb", "index", "middle", "ring", "pinky"];
    const metricNames = ["angle1", "angle2", "straightness", "reach"];
    const differences = [];
    digitNames.forEach((digitName, digitIndex) => {
      metricNames.forEach((metricName) => {
        const signMedian = median(positiveFrames.map((frame) => frame[digitIndex][metricName]));
        const grabMedian = median(negativeFrames.map((frame) => frame[digitIndex][metricName]));
        const scale = metricName.startsWith("angle") ? 180 : 1;
        differences.push({
          label: `${digitName} ${metricName}`,
          score: Math.abs(signMedian - grabMedian) / scale,
          signMedian,
          grabMedian,
          isAngle: metricName.startsWith("angle")
        });
      });
    });
    differences.sort((a, b) => b.score - a.score);
    comparison = differences.slice(0, 3).map((item) => {
      const format = (value) => item.isAngle ? `${value.toFixed(0)}°` : value.toFixed(2);
      return `${item.label}: correct ${format(item.signMedian)}, incorrect ${format(item.grabMedian)}`;
    }).join("<br>");
  }

  const topRules = profile?.rules?.slice(0, 5).map((rule) =>
    `${rule.feature}: ${rule.min.toFixed(2)} to ${rule.max.toFixed(2)} · weight ${rule.weight.toFixed(1)}`
  ).join("<br>") || "A learned profile is created after the first correct example.";
  const learnedPattern = profile?.learnedStatePattern?.map((state, index) => {
    const digit = ["T", "I", "M", "R", "P"][index];
    const confidence = Math.round((profile.stateConfidence?.[index] || 0) * 100);
    return `${digit} ${state.toUpperCase()} ${confidence}%`;
  }).join(" · ") || "Waiting for correct examples.";
  const maturity = profile?.evidence?.maturity || "untrained";

  calibrationReport.innerHTML = `
    <strong>${sign.label} evidence · ${maturity}</strong><br>
    Correct clips: ${positiveExamples.length} · ${positiveFrames.length} frames<br>
    Incorrect clips: ${negativeExamples.length} · ${negativeFrames.length} frames<br><br>
    <strong>Learned finger pattern</strong><br>${learnedPattern}
    <br><br>
    <strong>Largest measured differences</strong><br>${comparison}
    <br><br><strong>Highest-weight learned rules</strong><br>${topRules}
    ${buildRangeTable(`${sign.label} correct`, positiveFrames)}
    ${buildRangeTable("Incorrect examples", negativeFrames)}
  `;
}

async function finishRecording() {
  if (!recordingSession) return;
  const completedSession = recordingSession;
  recordingSession = null;
  const sign = getSign(completedSession.signId);
  const example = {
    signId: completedSession.signId,
    kind: completedSession.kind,
    recordedAt: new Date().toISOString(),
    frames: completedSession.samples,
    landmarkFrames: completedSession.landmarkFrames,
    evidenceFormat: "hand-landmarks-and-metrics-v1",
    containsVideo: false,
    containsAudio: false,
    researcherId: PRIMARY_RESEARCHER_ID,
    sessionId: researchSessionId,
    appVersion: APP_VERSION,
    handedness: "right",
    protocolStepId: completedSession.protocolStepId
  };
  const exampleId = await addExample(example);
  selectedExamples.push({ ...example, id: exampleId });
  const profile = buildLearnedProfile(completedSession.signId, selectedExamples);
  if (profile) {
    await saveProfile(profile);
    learnedProfiles.set(completedSession.signId, profile);
  }
  const kindLabel = completedSession.kind === "positive" ? "correct" : "incorrect";
  recordingStatus.textContent = `${sign.label} ${kindLabel} example saved: ${completedSession.samples.length} frames.`;
  recordingStatus.classList.remove("is-recording");
  recordingProgressBar.style.width = "100%";
  renderCalibrationReport();
  if (completedSession.guided && guidedSession) {
    guidedSession.index += 1;
    if (guidedSession.index >= guidedSession.steps.length) {
      finishGuidedTraining();
    } else {
      renderGuidedStep();
      guidedCaptureButton.disabled = false;
    }
  } else {
    document.querySelectorAll("[data-record]").forEach((button) => { button.disabled = false; });
    captureFalseMatchButton.disabled = false;
    calibrationSignSelect.disabled = false;
  }
}

function updateDiagnostics(landmarks, now) {
  if (!landmarks) {
    if (recordingSession && now >= recordingSession.endsAt) finishRecording();
    return;
  }
  const metrics = getHandMetrics(landmarks);
  if (!diagnosticsPanel.hidden) renderDiagnostics(metrics);

  if (recordingSession) {
    recordingSession.samples.push(metrics.map((digit) => ({ ...digit })));
    recordingSession.landmarkFrames.push(landmarks.map((point) => ({
      x: point.x,
      y: point.y,
      z: point.z || 0
    })));
    const remaining = Math.max(0, recordingSession.endsAt - now);
    const sign = getSign(recordingSession.signId);
    const kindLabel = recordingSession.kind === "positive" ? "correct" : "incorrect";
    recordingStatus.textContent = `Recording ${sign.label} ${kindLabel}: ${(remaining / 1000).toFixed(1)}s`;
    recordingProgressBar.style.width = `${Math.min(100, Math.max(0, (1 - remaining / 2000) * 100))}%`;
    if (remaining <= 0) finishRecording();
  }
}

function startRecording(kind, guided = false) {
  if (!isInitialized || lightingIsLow) {
    recordingStatus.textContent = lightingIsLow ? "Lighting too low" : "Complete camera calibration before recording.";
    guidedCaptureButton.disabled = false;
    return;
  }
  if (!stream?.active) {
    recordingStatus.textContent = "Start the camera before recording a pose.";
    return;
  }
  const sign = getSign(calibrationSignSelect.value);
  const guidedStep = guided && guidedSession ? guidedSession.steps[guidedSession.index] : null;
  recordingSession = {
    signId: sign.id,
    kind,
    endsAt: performance.now() + 2000,
    samples: [],
    landmarkFrames: [],
    guided,
    protocolStepId: guidedStep?.prompt.id
  };
  recordingStatus.classList.add("is-recording");
  recordingStatus.textContent = `Recording ${sign.label} ${kind === "positive" ? "correct" : "incorrect"}: 2.0s`;
  recordingProgressBar.style.width = "0%";
  document.querySelectorAll("#gesture-list li[data-gesture]").forEach((item) => item.classList.remove("is-active"));
  document.querySelectorAll("[data-record]").forEach((button) => { button.disabled = true; });
  captureFalseMatchButton.disabled = true;
  calibrationSignSelect.disabled = true;
}

function guidedStepsFor(sign) {
  return [
    ...sign.trainingProtocol.correct.map((prompt) => ({ kind: "positive", prompt })),
    ...sign.trainingProtocol.incorrect.map((prompt) => ({ kind: "negative", prompt }))
  ];
}

function renderGuidedStep() {
  if (!guidedSession) return;
  const step = guidedSession.steps[guidedSession.index];
  const position = guidedSession.index + 1;
  guidedStepCopy.textContent = `Step ${position} of ${guidedSession.steps.length}`;
  guidedKindCopy.textContent = step.kind === "positive" ? "Correct example" : "Incorrect example";
  guidedStepProgressBar.style.width = `${position / guidedSession.steps.length * 100}%`;
  guidedTitle.textContent = step.prompt.title;
  guidedInstruction.textContent = step.prompt.instruction;
}

function startGuidedTraining() {
  if (!isInitialized || lightingIsLow) {
    recordingStatus.textContent = lightingIsLow ? "Lighting too low" : "Complete camera calibration before training.";
    return;
  }
  if (!stream?.active) {
    recordingStatus.textContent = "Start the camera before beginning guided training.";
    return;
  }
  const sign = getSign(calibrationSignSelect.value);
  guidedSession = { signId: sign.id, steps: guidedStepsFor(sign), index: 0 };
  guidedTrainingPanel.hidden = false;
  guidedCaptureButton.disabled = false;
  startGuidedTrainingButton.disabled = true;
  calibrationSignSelect.disabled = true;
  document.querySelectorAll("[data-record]").forEach((button) => { button.disabled = true; });
  captureFalseMatchButton.disabled = true;
  recordingStatus.textContent = `${sign.label} guided session ready. Complete all eight steps.`;
  renderGuidedStep();
}

function finishGuidedTraining() {
  const sign = guidedSession ? getSign(guidedSession.signId) : null;
  guidedSession = null;
  recordingSession = null;
  guidedStepCopy.textContent = "Session complete";
  guidedKindCopy.textContent = "8 examples saved";
  guidedStepProgressBar.style.width = "100%";
  guidedTitle.textContent = `${sign?.label || "Sign"} training complete`;
  guidedInstruction.textContent = "The learned profile has been rebuilt from the full guided session.";
  guidedCaptureButton.disabled = true;
  startGuidedTrainingButton.disabled = false;
  calibrationSignSelect.disabled = false;
  document.querySelectorAll("[data-record]").forEach((button) => { button.disabled = false; });
  captureFalseMatchButton.disabled = false;
  recordingStatus.textContent = `${sign?.label || "Sign"} guided training complete.`;
}

function stopGuidedTraining() {
  guidedSession = null;
  recordingSession = null;
  guidedTrainingPanel.hidden = true;
  guidedCaptureButton.disabled = false;
  startGuidedTrainingButton.disabled = false;
  calibrationSignSelect.disabled = false;
  document.querySelectorAll("[data-record]").forEach((button) => { button.disabled = false; });
  captureFalseMatchButton.disabled = false;
  recordingStatus.classList.remove("is-recording");
  recordingStatus.textContent = "Guided session stopped. Saved steps remain in the evidence database.";
}

async function loadSelectedSignTraining() {
  selectedExamples = await getExamples(calibrationSignSelect.value);
  renderCalibrationReport();
}

async function rebuildStoredProfiles() {
  for (const sign of SIGN_BANK) {
    const examples = await getExamples(sign.id);
    if (!examples.length) continue;
    const profile = buildLearnedProfile(sign.id, examples);
    if (profile) {
      await saveProfile(profile);
      learnedProfiles.set(sign.id, profile);
    }
  }
}

function playPing() {
  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(620, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1040, audioContext.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.3);
}

function animateGestureRow(signId) {
  const row = document.querySelector(`#gesture-list li[data-sign-id="${signId}"]`);
  if (!row) return;
  row.classList.remove("is-hit");
  void row.offsetWidth;
  row.classList.add("is-hit");
}

function renderChainState(gameState) {
  const progress = activeLibrary === "number" ? gameState.progress : selectedLibraryGame().getState().progress;
  chainScore.render(progress, libraryTitle.textContent);
  if (activeLibrary !== "number") {
    recognitionModeCopy.textContent = activeLibrary === "word" ? "Word placeholders" : "Letter rules pending";
    return;
  }
  const { minimum: focusMinimum, maximum: focusMaximum } = numberFocusRange(gameState.progress);
  recognitionModeCopy.textContent = gameState.complete ? "Sequence complete" : `Target only: ${gameState.expected}`;
  document.querySelectorAll("#gesture-list li[data-gesture]").forEach((item) => {
    const number = Number(item.dataset.gesture);
    item.classList.toggle("is-complete", gameState.recognizedNumbers.includes(number));
    item.classList.toggle("is-target", !gameState.complete && number === gameState.expected);
    item.classList.toggle("is-deprioritized", number < focusMinimum || number > focusMaximum);
  });
}

function resetGameProgress() {
  clearTimeout(learningFinishTimer);
  clearCountdownDisplay();
  clearTimeout(learningPromptTimer);
  learningMode.reset();
  learningModeBanner.hidden = true;
  learningActivationHistory = [];
  learningActivationArmed = true;
  recentLearningFrames = [];
  clearTimeout(responseTimer);
  clearTimeout(rewardTimer);
  clearTimeout(failureTimer);
  clearTimeout(delayedFailureTimer);
  selectedLibraryGame().reset();
  renderChainState(chainGame.getState());
  resetPracticeTarget();
  motionReadout.hidden = true;
  motionLabelCopy.textContent = "Motion tracking";
  motionPhaseCopy.textContent = "Hold a number pose or begin a pinch";
  motionDistanceCopy.textContent = "Waiting for a complete movement";
  motionProgressBar.style.width = "0%";
  gestureResponse.classList.remove("is-pinging");
  gestureResponse.classList.remove("is-learning-prompt", "is-learning-close");
  gestureResponse.setAttribute("aria-hidden", "true");
  chainReward.classList.remove("is-showing");
  chainReward.setAttribute("aria-hidden", "true");
  chainFailure.classList.remove("is-showing");
  chainFailure.setAttribute("aria-hidden", "true");
  document.querySelectorAll("#gesture-list li").forEach((item) => {
    item.classList.remove("is-active", "is-hit", "is-milestone-flash", "is-error-hit");
  });
}

function showChainReward(numbers, progress) {
  clearTimeout(rewardTimer);
  chainRewardCopy.textContent = `Numbers ${progress - 4} to ${progress} complete`;
  document.querySelectorAll("#gesture-list li[data-gesture]").forEach((item) => {
    item.classList.toggle("is-milestone-flash", numbers.includes(Number(item.dataset.gesture)));
  });
  chainReward.setAttribute("aria-hidden", "false");
  chainReward.classList.remove("is-showing");
  void chainReward.offsetWidth;
  chainReward.classList.add("is-showing");
  rewardTimer = setTimeout(() => {
    chainReward.classList.remove("is-showing");
    chainReward.setAttribute("aria-hidden", "true");
    document.querySelectorAll("#gesture-list li.is-milestone-flash").forEach((item) => {
      item.classList.remove("is-milestone-flash");
    });
  }, 1450);
}

function playFailureTone() {
  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(180, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(95, audioContext.currentTime + 0.22);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.1, audioContext.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.3);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.31);
}

function showChainFailure(result) {
  clearCountdownDisplay();
  clearTimeout(failureTimer);
  clearTimeout(rewardTimer);
  clearTimeout(responseTimer);
  chainReward.classList.remove("is-showing");
  chainReward.setAttribute("aria-hidden", "true");
  document.querySelectorAll("#gesture-list li.is-milestone-flash").forEach((item) => {
    item.classList.remove("is-milestone-flash");
  });
  gestureResponse.classList.remove("is-pinging");
  gestureResponse.setAttribute("aria-hidden", "true");
  chainFailureCopy.textContent = result.reason === "timeout"
    ? (result.state.progress ? `Time up. Checkpoint ${result.state.progress} secured` : "Time up. Start again at number 1")
    : (result.state.progress ? `Chain reset to checkpoint ${result.state.progress}` : "First chain reset. Start again at number 1");
  chainFailure.setAttribute("aria-hidden", "false");
  chainFailure.classList.remove("is-showing");
  void chainFailure.offsetWidth;
  chainFailure.classList.add("is-showing");
  const wrongRow = document.querySelector(`#gesture-list li[data-gesture="${result.received}"]`);
  if (wrongRow) {
    wrongRow.classList.remove("is-error-hit");
    void wrongRow.offsetWidth;
    wrongRow.classList.add("is-error-hit");
  }
  playFailureTone();
  failureTimer = setTimeout(() => {
    chainFailure.classList.remove("is-showing");
    chainFailure.setAttribute("aria-hidden", "true");
    wrongRow?.classList.remove("is-error-hit");
  }, 1000);
}

function showGestureResponse(signId, award = false) {
  const sign = getSign(signId);
  if (!sign) return;
  // Help clicks are visual only. Even an accidental caller cannot award a non-target.
  if (award && sign.id !== requestedSign()?.id) return;
  const learningState = learningMode.getState();
  const learningResult = award && learningState.active && sign.category === "number"
    ? learningMode.submit(Number(sign.shortLabel))
    : null;
  const gameResult = award && !learningState.active && sign.category === "number"
    ? chainGame.submit(Number(sign.shortLabel))
    : null;
  if (gameResult) {
    clearCountdownDisplay();
    renderChainState(gameResult.state);
  }
  clearTimeout(delayedFailureTimer);
  clearTimeout(responseTimer);
  responseImage.src = sign.promptAsset;
  responseImage.alt = `BSL ${sign.label}`;
  responseImage.classList.toggle("is-inverted", sign.id === "bsl-number-6");
  gestureResponse.setAttribute("aria-hidden", "false");
  gestureResponse.classList.remove("is-pinging", "is-learning-prompt", "is-learning-close");
  void gestureResponse.offsetWidth;
  gestureResponse.classList.add("is-pinging");
  animateGestureRow(signId);
  playPing();
  if (gameResult?.type === "accepted" && gameResult.milestone) {
    showChainReward(gameResult.milestone, gameResult.state.progress);
  }
  if (gameResult?.type === "accepted") prepareNextTarget(gameResult.state);
  if (learningResult?.accepted) {
    void saveLearningEvidence(sign);
    learningModeCopy.textContent = learningResult.finished
      ? "Five signs learned"
      : `${learningResult.state.completed.length} of 5 · next number ${learningResult.state.expected}`;
    if (learningResult.finished) {
      learningFinishTimer = setTimeout(() => finishLearningMode(learningResult.state), 1000);
    } else {
      showLearningPrompt(learningResult.state.expected, 1000);
    }
  }
  responseTimer = setTimeout(() => {
    gestureResponse.classList.remove("is-pinging");
    if (!gestureResponse.classList.contains("is-learning-prompt")) {
      gestureResponse.setAttribute("aria-hidden", "true");
    }
  }, 1000);
  if (gameResult?.type === "failed") {
    delayedFailureTimer = setTimeout(() => showChainFailure(gameResult), 1000);
  }
}

async function loadTracker() {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
    );

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55
    });

    try {
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false
      });
    } catch (error) {
      console.warn("Head tracker unavailable; camera calibration cannot complete", error);
    }

    startButton.disabled = false;
    setStatus("Tracker ready. Camera off");
  } catch (error) {
    console.error(error);
    setStatus("Could not load hand tracker. Check your connection", "is-error");
    startButton.textContent = "Reload page";
    startButton.disabled = false;
    startButton.addEventListener("click", () => location.reload(), { once: true });
  }
}

async function startCamera() {
  startButton.disabled = true;
  setStatus("Requesting camera access");

  try {
    audioContext ||= new AudioContext();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    instruction.classList.add("is-running");
    initializationGate.hidden = false;
    stage.classList.add("is-calibrating");
    framingHold.reset();
    setStatus("Calibrating. Frame your head and both hands", "is-live");
    requestAnimationFrame(track);
  } catch (error) {
    console.error(error);
    startButton.disabled = false;
    startButton.textContent = "Try again";
    setStatus("Camera unavailable or permission denied", "is-error");
  }
}

function resizeCanvas() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
  }
  context.setTransform(scale, 0, 0, scale, 0, 0);
  return { width, height };
}

function coverTransform(stageWidth, stageHeight) {
  const sourceRatio = video.videoWidth / video.videoHeight;
  const stageRatio = stageWidth / stageHeight;
  if (sourceRatio > stageRatio) {
    const drawnWidth = stageHeight * sourceRatio;
    return { x: (stageWidth - drawnWidth) / 2, y: 0, width: drawnWidth, height: stageHeight };
  }
  const drawnHeight = stageWidth / sourceRatio;
  return { x: 0, y: (stageHeight - drawnHeight) / 2, width: stageWidth, height: drawnHeight };
}

function drawHand(landmarks, bounds) {
  const point = (index) => ({
    x: bounds.x + landmarks[index].x * bounds.width,
    y: bounds.y + landmarks[index].y * bounds.height
  });

  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "rgba(255, 122, 0, 0.7)";
  context.lineWidth = 1.25;
  context.shadowColor = "rgba(255, 122, 0, 0.45)";
  context.shadowBlur = 8;
  context.beginPath();
  for (const [start, end] of CONNECTIONS) {
    const a = point(start);
    const b = point(end);
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
  }
  context.stroke();
  context.shadowBlur = 0;

  landmarks.forEach((_, index) => {
    const p = point(index);

    if (FINGERTIPS.has(index)) {
      const crossSize = 5;
      context.beginPath();
      context.moveTo(p.x - crossSize, p.y);
      context.lineTo(p.x + crossSize, p.y);
      context.moveTo(p.x, p.y - crossSize);
      context.lineTo(p.x, p.y + crossSize);
      context.strokeStyle = "rgba(255, 255, 255, 0.5)";
      context.lineWidth = 1.25;
      context.stroke();
      return;
    }

    context.beginPath();
    context.arc(p.x, p.y, index === 0 ? 5 : 3, 0, Math.PI * 2);
    context.fillStyle = index === 0 ? "#ffffff" : "#ff7a00";
    context.fill();
  });

  const fingerStates = getHandMetrics(landmarks).map((digit) => digit.state);
  FINGER_LABELS.forEach(({ label, tip }, index) => {
    if (fingerStates[index] !== DIGIT_STATE.EXTENDED) return;
    const p = point(tip);
    context.save();
    context.translate(p.x, p.y - INDEX_LABEL_OFFSET);
    context.scale(-1, 1);
    context.fillStyle = "rgba(255, 255, 255, 0.85)";
    context.font = "600 11px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, 0, 0);
    context.restore();
  });

  const wrist = point(0);
  const palmAngle = mirrorSignedHandAngle(getPalmFrame(landmarks).signedAngle);
  const displayedAngle = Math.abs(palmAngle) < 0.5 ? 0 : Math.round(palmAngle);
  context.save();
  context.translate(wrist.x, wrist.y + 18);
  context.scale(-1, 1);
  context.fillStyle = "rgba(255, 255, 255, 0.85)";
  context.font = "600 11px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(`${displayedAngle}°`, 0, 0);
  context.restore();
}

function updateFps(now) {
  frameCount += 1;
  const elapsed = now - fpsStartedAt;
  if (elapsed >= 750) {
    fpsCopy.textContent = `${Math.round((frameCount * 1000) / elapsed).toString().padStart(2, "0")} FPS`;
    frameCount = 0;
    fpsStartedAt = now;
  }
}

function track(now) {
  if (!stream?.active || video.readyState < 2) {
    requestAnimationFrame(track);
    return;
  }

  const size = resizeCanvas();
  context.clearRect(0, 0, size.width, size.height);
  const bounds = coverTransform(size.width, size.height);

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const results = handLandmarker.detectForVideo(video, now);
    if (faceLandmarker && now - lastFaceCheckAt >= 100) {
      lastFaceCheckAt = now;
      try {
        faceLandmarks = faceLandmarker.detectForVideo(video, now).faceLandmarks?.[0] || [];
      } catch (error) {
        console.error("Head tracking failed", error);
        faceLandmarks = [];
        faceLandmarker = undefined;
      }
    }
    const keptHandIndices = (results.landmarks || [])
      .map((landmarks, index) => ({ landmarks, index }))
      .filter(({ landmarks }) => !faceLandmarks.length || !handOverlapsFace(landmarks, faceLandmarks));
    const hands = keptHandIndices.map(({ landmarks }) => landmarks);
    updateLighting(hands, now);
    const wasInitialized = isInitialized;
    updateCameraFraming(hands, { width: size.width, height: size.height, videoBounds: bounds }, now);
    const handedness = results.handedness || results.handednesses || [];
    const filteredResults = {
      ...results,
      landmarks: hands,
      handedness: keptHandIndices.map(({ index }) => handedness[index]).filter(Boolean),
      handednesses: keptHandIndices.map(({ index }) => handedness[index]).filter(Boolean)
    };
    updateLibraryNavigation(hands, filteredResults, { width: size.width, height: size.height, videoBounds: bounds }, now);
    if (!isInitialized || lightingIsLow) lastDetectedHands = lightingIsLow ? [] : hands;
    else if (hands.length) lastDetectedHands = hands;
    else if ((results.landmarks || []).length) lastDetectedHands = [];
    if (wasInitialized) {
      const handMetrics = hands.map((landmarks) => getHandMetrics(landmarks));
      const handOrientations = hands.map((landmarks) => getHandOrientation(landmarks));
      if (!lightingIsLow && !recordingSession && now >= practiceFeedbackUntil) updateLearningActivation(handMetrics);
      if (!lightingIsLow && !recordingSession && learningMode.getState().active) {
        if (hands.length === 1) {
          recentLearningFrames.push({ metrics: handMetrics[0], landmarks: hands[0] });
          if (recentLearningFrames.length > 30) recentLearningFrames.shift();
        } else if (hands.length > 1) {
          recentLearningFrames = [];
        }
      }
      updateTargetPractice(hands, handMetrics, handOrientations, now);
    }
    if (!lightingIsLow && isInitialized) updateDiagnostics(hands[0] || null, now);
    updateHandPositionIndicators(filteredResults, now);
    updateDistanceAlert(hands, now, { width: size.width, height: size.height, videoBounds: bounds });
    handCountCopy.textContent = `${hands.length} ${hands.length === 1 ? "HAND" : "HANDS"}`;
    if (isInitialized && !lightingIsLow) {
      setStatus(hands.length ? `Tracking ${hands.length} hand${hands.length > 1 ? "s" : ""}` : "Camera live. Looking for hands", "is-live");
    }
  }

  lastDetectedHands.forEach((landmarks) => drawHand(landmarks, bounds));

  updateFps(now);
  requestAnimationFrame(track);
}

startButton.addEventListener("click", startCamera);
libraryTabs.forEach(tab => {
  let hoverTimer;
  tab.addEventListener("pointerenter", () => {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (!pointGestureReset.isBlocked(libraryButtonGroup)) tab.classList.add("is-pointer-hover");
    }, MIN_BUTTON_INTENT_MS);
  });
  tab.addEventListener("pointerleave", () => {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => tab.classList.remove("is-pointer-hover"), MIN_BUTTON_INTENT_MS);
  });
  tab.addEventListener("click", () => {
    if (pointGestureReset.isBlocked(libraryButtonGroup)) return;
    clearTimeout(manualSelectionTimer);
    // Click/keyboard selection also has a minimum confirmation window.
    manualSelectionTimer = setTimeout(() => switchLibrary(tab.dataset.library), MIN_BUTTON_INTENT_MS);
  });
});
diagnosticsToggle.addEventListener("click", () => {
  diagnosticsPanel.hidden = !diagnosticsPanel.hidden;
  diagnosticsToggle.setAttribute("aria-expanded", String(!diagnosticsPanel.hidden));
});
diagnosticsClose.addEventListener("click", () => {
  diagnosticsPanel.hidden = true;
  diagnosticsToggle.setAttribute("aria-expanded", "false");
});
document.querySelectorAll("[data-record]").forEach((button) => {
  button.addEventListener("click", () => startRecording(button.dataset.record));
});
startGuidedTrainingButton.addEventListener("click", startGuidedTraining);
captureFalseMatchButton.addEventListener("click", () => startRecording("negative"));
guidedCaptureButton.addEventListener("click", () => {
  if (!guidedSession) return;
  guidedCaptureButton.disabled = true;
  startRecording(guidedSession.steps[guidedSession.index].kind, true);
});
guidedStopButton.addEventListener("click", stopGuidedTraining);
clearCalibrationButton.addEventListener("click", async () => {
  recordingSession = null;
  await clearSignTraining(calibrationSignSelect.value);
  learnedProfiles.delete(calibrationSignSelect.value);
  selectedExamples = [];
  recordingStatus.textContent = "Selected sign training reset.";
  recordingStatus.classList.remove("is-recording");
  recordingProgressBar.style.width = "0%";
  document.querySelectorAll("[data-record]").forEach((button) => { button.disabled = false; });
  renderCalibrationReport();
});
gestureList.addEventListener("click", (event) => {
  const item = event.target.closest("li[data-gesture]");
  if (item) {
    showGestureResponse(item.dataset.signId);
  }
});
gestureList.addEventListener("keydown", (event) => {
  const item = event.target.closest("li[data-gesture]");
  if (item && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    showGestureResponse(item.dataset.signId);
  }
});
calibrationSignSelect.addEventListener("change", loadSelectedSignTraining);
exportTrainingButton.addEventListener("click", async () => {
  const data = await exportTrainingData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bsl-training-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  recordingStatus.textContent = `Training database exported: ${data.examples.length} examples.`;
});
importTrainingInput.addEventListener("change", async () => {
  const file = importTrainingInput.files?.[0];
  if (!file) return;
  try {
    await importTrainingData(JSON.parse(await file.text()));
    learnedProfiles.clear();
    (await getAllProfiles()).forEach((profile) => learnedProfiles.set(profile.signId, profile));
    await loadSelectedSignTraining();
    recordingStatus.textContent = "Training database imported.";
  } catch (error) {
    console.error(error);
    recordingStatus.textContent = "Could not import this training file.";
  } finally {
    importTrainingInput.value = "";
  }
});
window.addEventListener("pagehide", () => stream?.getTracks().forEach((track) => track.stop()));

async function initializeTrainingDatabase() {
  calibrationSignSelect.innerHTML = SIGN_BANK
    .filter((sign) => sign.hands === 1 && sign.recognitionType === "static")
    .map((sign) => `<option value="${sign.id}">${sign.label}</option>`)
    .join("");
  try {
    (await getAllProfiles()).forEach((profile) => learnedProfiles.set(profile.signId, profile));
    await rebuildStoredProfiles();
    await loadSelectedSignTraining();
  } catch (error) {
    console.error(error);
    recordingStatus.textContent = "Training database unavailable in this browser session.";
  }
}

renderChainState(chainGame.getState());
initializeTrainingDatabase();

if (!navigator.mediaDevices?.getUserMedia) {
  setStatus("This browser does not support webcam access", "is-error");
  startButton.disabled = true;
} else {
  loadTracker();
}
