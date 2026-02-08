let intervalId = null;
let durationMs = 0;
let remainingMs = 0;
let endTs = 0;
let isRunning = false;
let isPaused = false;
let tickHandler = null;
let endHandler = null;

function clearTickLoop() {
  if (intervalId) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function emitTick() {
  if (typeof tickHandler === "function") {
    const safeMs = Math.max(0, Math.round(remainingMs));
    tickHandler(safeMs);
  }
}

function updateFromTimestamp() {
  if (!isRunning || isPaused) {
    return;
  }

  remainingMs = Math.max(0, endTs - Date.now());
  emitTick();

  if (remainingMs <= 0) {
    stopTimer();
    if (typeof endHandler === "function") {
      endHandler();
    }
  }
}

function startLoop() {
  clearTickLoop();
  intervalId = window.setInterval(updateFromTimestamp, 100);
}

export function startTimer(totalMs, onTick, onEnd) {
  durationMs = Math.max(0, Number(totalMs) || 0);
  remainingMs = durationMs;
  tickHandler = onTick;
  endHandler = onEnd;
  isRunning = true;
  isPaused = false;
  endTs = Date.now() + remainingMs;
  emitTick();
  startLoop();
}

export function pauseTimer() {
  if (!isRunning || isPaused) {
    return;
  }
  remainingMs = Math.max(0, endTs - Date.now());
  isPaused = true;
  clearTickLoop();
  emitTick();
}

export function resumeTimer() {
  if (!isRunning || !isPaused || remainingMs <= 0) {
    return;
  }
  isPaused = false;
  endTs = Date.now() + remainingMs;
  startLoop();
  emitTick();
}

export function resetTimer(newTotalMs = null) {
  if (newTotalMs !== null && newTotalMs !== undefined) {
    durationMs = Math.max(0, Number(newTotalMs) || 0);
  }
  remainingMs = durationMs;
  if (isRunning && !isPaused) {
    endTs = Date.now() + remainingMs;
  }
  emitTick();
}

export function stopTimer() {
  clearTickLoop();
  isRunning = false;
  isPaused = false;
  endTs = 0;
}

export function getRemainingMs() {
  if (isRunning && !isPaused) {
    return Math.max(0, Math.round(endTs - Date.now()));
  }
  return Math.max(0, Math.round(remainingMs));
}

export function timerIsRunning() {
  return isRunning;
}

export function timerIsPaused() {
  return isPaused;
}

export function formatMMSS(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
