let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    return null;
  }
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  return audioCtx;
}

async function ensureContextReady() {
  const ctx = getAudioContext();
  if (!ctx) {
    return null;
  }
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return null;
    }
  }
  return ctx;
}

function playTone(ctx, freq, startAt, duration, type = "sine", gainValue = 0.08) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startAt);
  osc.stop(startAt + duration + 0.01);
}

export async function playCorrectSfx(enabled = true) {
  if (!enabled) return;
  const ctx = await ensureContextReady();
  if (!ctx) return;
  const now = ctx.currentTime + 0.005;
  playTone(ctx, 523.25, now, 0.13, "sine", 0.075);
  playTone(ctx, 659.25, now + 0.08, 0.13, "sine", 0.075);
  playTone(ctx, 783.99, now + 0.16, 0.16, "triangle", 0.07);
}

export async function playWrongSfx(enabled = true) {
  if (!enabled) return;
  const ctx = await ensureContextReady();
  if (!ctx) return;
  const now = ctx.currentTime + 0.005;
  playTone(ctx, 370, now, 0.14, "triangle", 0.07);
  playTone(ctx, 294, now + 0.11, 0.18, "sawtooth", 0.06);
}

export async function playCountdownTickSfx(enabled = true) {
  if (!enabled) return;
  const ctx = await ensureContextReady();
  if (!ctx) return;
  const now = ctx.currentTime + 0.002;
  playTone(ctx, 1150, now, 0.06, "square", 0.03);
}

export async function playTimeUpSfx(enabled = true) {
  if (!enabled) return;
  const ctx = await ensureContextReady();
  if (!ctx) return;
  const now = ctx.currentTime + 0.005;
  playTone(ctx, 440, now, 0.14, "triangle", 0.07);
  playTone(ctx, 392, now + 0.12, 0.14, "triangle", 0.07);
  playTone(ctx, 349, now + 0.24, 0.2, "sawtooth", 0.065);
}

