import { KnobTurns, readHand, TURN_THRESHOLD } from "./knob.mjs";
import { FilesetResolver, GestureRecognizer } from
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs";

const button = document.querySelector("button");
const status = document.querySelector("#status");
const grip = document.querySelector("#grip");
const label = document.querySelector("output");
const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
const decoder = new TextDecoder();
let recognizer;
const knob = new KnobTurns();
const progress = document.querySelector("progress");
progress.max = TURN_THRESHOLD;

function showGrip(message, held = false) {
  if (grip.textContent !== message) grip.textContent = message;
  grip.dataset.held = String(held);
}

function renderKnob() {
  const value = String(knob.turns);
  if (label.textContent !== value) label.textContent = value;
  progress.value = Math.max(0, knob.degrees);
}

async function processFrame(line) {
  const jpeg = Uint8Array.from(atob(line.slice(6)), character => character.charCodeAt(0));
  const frame = await createImageBitmap(new Blob([jpeg], { type: "image/jpeg" }));
  context.drawImage(frame, 0, 0, canvas.width, canvas.height);
  frame.close();
  const result = recognizer.recognize(canvas);
  const hand = readHand(result.landmarks[0], canvas.width, canvas.height, knob.gripped, result.worldLandmarks?.[0]);
  knob.update(hand);
  renderKnob();
  if (knob.holdingTurn) {
    const action = knob.activeDirection > 0 ? "add" : "subtract";
    showGrip(`Knob turned. Hold here to ${action} 1 every 0.5 seconds.`, true);
  } else if (hand?.gripped) {
    showGrip("Holding the knob. Turn clockwise to add or counterclockwise to subtract.", true);
  } else if (knob.gripped && !hand) {
    showGrip("Grip temporarily out of view.");
  } else {
    showGrip(hand ? "Pinch your thumb and index finger to grab the knob." : "Show one hand to the camera.");
  }
}

button.addEventListener("click", async () => {
  button.disabled = true;
  let port, reader, writer, timeout, retryJob;
  try {
    if (!navigator.serial) throw new Error("Open this page in Google Chrome on localhost.");
    port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x303a }] });
    status.textContent = "Loading the hand recognition model…";
    recognizer ??= await GestureRecognizer.createFromOptions(
      await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm"),
      { baseOptions: { modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task" },
        runningMode: "IMAGE", numHands: 1 });
    await port.open({ baudRate: 115200, bufferSize: 262144 });
    reader = port.readable.getReader();
    writer = port.writable.getWriter();
    status.textContent = "Waiting for camera…";
    showGrip("Waiting for the live preview.");
    let pending = "";
    let missedFrames = 0;
    const requestFrame = async () => {
      await writer.write(Uint8Array.of(70));
      timeout = setTimeout(() => {
        if (++missedFrames >= 3) {
          void reader.cancel();
          return;
        }
        pending = "";
        knob.release();
        renderKnob();
        status.textContent = "Recovering camera feed…";
        showGrip("Grip tracking paused.");
        retryJob = requestFrame().catch(() => reader.cancel());
      }, 5000);
    };
    await requestFrame();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error("No camera frames after three attempts. Reconnect the CoreS3 and try again.");
      pending += decoder.decode(value, { stream: true });
      if (pending.length > 262144) pending = pending.slice(-262144);
      const lines = pending.split("\n");
      pending = lines.pop();
      let frameReceived = false;
      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (line.startsWith("ERROR ")) throw new Error(line.slice(6));
        const start = line.lastIndexOf("FRAME ");
        if (start < 0) continue;
        try {
          await processFrame(line.slice(start));
          frameReceived = true;
        } catch (error) {
          if (!["InvalidCharacterError", "InvalidStateError"].includes(error.name)) throw error;
        }
      }
      if (frameReceived) {
        if (status.textContent !== "Camera connected") status.textContent = "Camera connected";
        if (retryJob) await retryJob;
        clearTimeout(timeout);
        missedFrames = 0;
        await requestFrame();
      }
    }
  } catch (error) {
    knob.release();
    renderKnob();
    showGrip("Connect the CoreS3 to start.");
    context.clearRect(0, 0, canvas.width, canvas.height);
    status.textContent = error.name === "NotFoundError" ? "No CoreS3 selected." : error.message;
  } finally {
    clearTimeout(timeout);
    reader?.releaseLock();
    writer?.releaseLock();
    if (port?.readable || port?.writable) await port.close().catch(() => {});
    button.disabled = false;
  }
});
