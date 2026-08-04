import {
  FilesetResolver,
  HandLandmarker
} from "@mediapipe/tasks-vision";
import "./styles.css";
import { DIGIT_STATE, getHandMetrics } from "./core/hand-metrics.ts";
import { SIGN_BANK, getSign } from "./core/sign-bank.ts";
import { buildLearnedProfile, recognizeHands } from "./core/sign-engine.ts";
import { createChainGame } from "./core/chain-game.ts";
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
const gestureList = document.querySelector("#gesture-list");
const gestureResponse = document.querySelector("#gesture-response");
const responseImage = document.querySelector("#response-image");
const chainMeter = document.querySelector("#chain-meter");
const chainCountCopy = document.querySelector("#chain-count");
const chainReward = document.querySelector("#chain-reward");
const chainRewardCopy = document.querySelector("#chain-reward-copy");
const chainFailure = document.querySelector("#chain-failure");
const chainFailureCopy = document.querySelector("#chain-failure-copy");
const diagnosticsToggle = document.querySelector("#diagnostics-toggle");
const diagnosticsPanel = document.querySelector("#diagnostics-panel");
const diagnosticsClose = document.querySelector("#diagnostics-close");
const diagnosticsBody = document.querySelector("#diagnostics-body");
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
let stream;
let lastVideoTime = -1;
let frameCount = 0;
let fpsStartedAt = performance.now();
let lastDetectedHands = [];
let lastTriggeredGesture = null;
let lastTriggeredAt = 0;
let audioContext;
let responseTimer;
let rewardTimer;
let failureTimer;
let gestureHistory = [];
let recordingSession = null;
let selectedExamples = [];
let guidedSession = null;
const learnedProfiles = new Map();
const researchSessionId = createSessionId();
const chainGame = createChainGame();

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
    calibrationReport.innerHTML = `<strong>${sign.label}</strong><br>No training examples yet. Add at least three correct and two incorrect examples.`;
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
  const maturity = profile?.evidence?.maturity || "untrained";

  calibrationReport.innerHTML = `
    <strong>${sign.label} evidence · ${maturity}</strong><br>
    Correct clips: ${positiveExamples.length} · ${positiveFrames.length} frames<br>
    Incorrect clips: ${negativeExamples.length} · ${negativeFrames.length} frames<br><br>
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
  gestureHistory = [];
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
  chainCountCopy.textContent = String(gameState.progress).padStart(2, "0");
  chainMeter.classList.toggle("is-chaining", gameState.progress > 1);
  document.querySelectorAll("#gesture-list li[data-gesture]").forEach((item) => {
    item.classList.toggle("is-complete", Number(item.dataset.gesture) <= gameState.progress);
  });
}

function showChainReward(numbers) {
  clearTimeout(rewardTimer);
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  chainRewardCopy.textContent = `Numbers ${first} to ${last} chained`;
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
  chainFailureCopy.textContent = result.state.progress === 5
    ? "Second chain reset to checkpoint 5"
    : "First chain reset. Start again at number 1";
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
  const gameResult = award && sign.category === "number"
    ? chainGame.submit(Number(sign.shortLabel))
    : null;
  if (gameResult) {
    renderChainState(gameResult.state);
    if (gameResult.type === "failed") {
      showChainFailure(gameResult);
      return;
    }
  }
  clearTimeout(responseTimer);
  responseImage.src = sign.promptAsset;
  responseImage.alt = `BSL ${sign.label}`;
  responseImage.classList.toggle("is-inverted", sign.id === "bsl-number-6");
  gestureResponse.setAttribute("aria-hidden", "false");
  gestureResponse.classList.remove("is-pinging");
  void gestureResponse.offsetWidth;
  gestureResponse.classList.add("is-pinging");
  animateGestureRow(signId);
  playPing();
  if (gameResult?.type === "accepted" && gameResult.milestone) showChainReward(gameResult.milestone);
  responseTimer = setTimeout(() => {
    gestureResponse.classList.remove("is-pinging");
    gestureResponse.setAttribute("aria-hidden", "true");
  }, 1000);
}

function updateGestureRecognition(rawSignId, now) {
  gestureHistory.push(rawSignId);
  if (gestureHistory.length > 12) gestureHistory.shift();

  const counts = new Map();
  gestureHistory.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const consensus = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const signId = gestureHistory.length === 12 && consensus?.[1] >= 10 ? consensus[0] : undefined;

  document.querySelectorAll("#gesture-list li[data-gesture]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.signId === signId);
  });

  if (signId === undefined) return;
  if (signId === null) {
    lastTriggeredGesture = null;
    return;
  }

  const cooledDown = now - lastTriggeredAt > 900;
  const changed = signId !== lastTriggeredGesture;
  if (cooledDown && changed) {
    showGestureResponse(signId, true);
    lastTriggeredGesture = signId;
    lastTriggeredAt = now;
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
    setStatus("Camera live. Looking for hands", "is-live");
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
    context.translate(p.x, p.y - 16);
    context.scale(-1, 1);
    context.fillStyle = "rgba(255, 255, 255, 0.85)";
    context.font = "600 11px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, 0, 0);
    context.restore();
  });
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
    const hands = results.landmarks || [];
    if (hands.length) lastDetectedHands = hands;
    if (!recordingSession) {
      const handMetrics = hands.map((landmarks) => getHandMetrics(landmarks));
      const recognition = handMetrics.length ? recognizeHands(SIGN_BANK, handMetrics, learnedProfiles) : null;
      updateGestureRecognition(recognition?.match?.sign.id || null, now);
    }
    updateDiagnostics(hands[0] || null, now);
    handCountCopy.textContent = `${hands.length} ${hands.length === 1 ? "HAND" : "HANDS"}`;
    setStatus(hands.length ? `Tracking ${hands.length} hand${hands.length > 1 ? "s" : ""}` : "Camera live. Looking for hands", "is-live");
  }

  lastDetectedHands.forEach((landmarks) => drawHand(landmarks, bounds));

  updateFps(now);
  requestAnimationFrame(track);
}

startButton.addEventListener("click", startCamera);
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
  if (item) showGestureResponse(item.dataset.signId);
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
    .filter((sign) => sign.hands === 1)
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

initializeTrainingDatabase();

if (!navigator.mediaDevices?.getUserMedia) {
  setStatus("This browser does not support webcam access", "is-error");
  startButton.disabled = true;
} else {
  loadTracker();
}
