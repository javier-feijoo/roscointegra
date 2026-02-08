const hasWebSpeech = typeof window !== "undefined" && "speechSynthesis" in window;
let activeAudio = null;
let audioMap = null;
let audioMapLoaded = false;
let voicesChangedHandlers = [];

const ttsStatus = {
  mode: "none",
  message: "",
  webSupported: hasWebSpeech,
  voicesAvailable: false
};

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function sortVoices(voices) {
  return [...voices].sort((a, b) => {
    const aEs = String(a.lang || "").toLowerCase().startsWith("es");
    const bEs = String(b.lang || "").toLowerCase().startsWith("es");
    if (aEs !== bEs) {
      return aEs ? -1 : 1;
    }
    return String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" });
  });
}

function pickPreferredVoice(voices, requestedName = "") {
  if (!voices.length) {
    return null;
  }

  if (requestedName) {
    const exact = voices.find((voice) => voice.name === requestedName);
    if (exact) {
      return exact;
    }
  }

  const spanish = voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith("es"));
  return spanish || voices[0];
}

function setStatus(mode, message) {
  ttsStatus.mode = mode;
  ttsStatus.message = message;
  ttsStatus.webSupported = hasWebSpeech;
}

function stopActiveAudio() {
  if (!activeAudio) {
    return;
  }
  activeAudio.pause();
  activeAudio.currentTime = 0;
  activeAudio.src = "";
  activeAudio = null;
}

async function loadAudioMap() {
  if (audioMapLoaded) {
    return audioMap;
  }

  audioMapLoaded = true;
  try {
    const response = await fetch("./assets/audio/audio_map.json", { cache: "no-store" });
    if (!response.ok) {
      audioMap = null;
      return null;
    }
    const parsed = await response.json();
    audioMap = parsed && typeof parsed === "object" ? parsed : null;
    return audioMap;
  } catch (_error) {
    audioMap = null;
    return null;
  }
}

function getAudioCandidates(options = {}) {
  const candidates = [];

  if (Array.isArray(options.audioCandidates)) {
    candidates.push(...options.audioCandidates);
  }

  if (audioMap) {
    if (options.questionId && audioMap.questions && typeof audioMap.questions === "object") {
      const mapped = audioMap.questions[String(options.questionId)];
      if (mapped) {
        candidates.push(mapped);
      }
    }

    if (options.letter && options.questionIndex && audioMap.by_letter && typeof audioMap.by_letter === "object") {
      const key = `${options.letter}_${options.questionIndex}`;
      const mapped = audioMap.by_letter[key];
      if (mapped) {
        candidates.push(mapped);
      }
    }
  }

  if (options.letter && options.questionIndex) {
    candidates.push(`${options.letter}_${options.questionIndex}.mp3`);
  }

  if (options.letter) {
    candidates.push(`${options.letter}.mp3`);
  }

  return unique(candidates).map((name) => `./assets/audio/${String(name).replace(/^\/+/, "")}`);
}

function playAudioCandidates(candidates, idx = 0) {
  return new Promise((resolve) => {
    if (idx >= candidates.length) {
      resolve(false);
      return;
    }

    const src = candidates[idx];
    const audio = new Audio(src);
    activeAudio = audio;

    const cleanup = () => {
      audio.oncanplaythrough = null;
      audio.onerror = null;
      audio.onended = null;
    };

    audio.oncanplaythrough = () => {
      audio.play().then(() => {
        cleanup();
        setStatus("audio", "Reproduccion de audio local.");
        resolve(true);
      }).catch(() => {
        cleanup();
        playAudioCandidates(candidates, idx + 1).then(resolve);
      });
    };

    audio.onerror = () => {
      cleanup();
      playAudioCandidates(candidates, idx + 1).then(resolve);
    };

    audio.load();
  });
}

function notifyVoicesChanged() {
  voicesChangedHandlers.forEach((handler) => {
    if (typeof handler === "function") {
      handler();
    }
  });
}

export function listVoices() {
  if (!hasWebSpeech) {
    ttsStatus.voicesAvailable = false;
    setStatus("none", "TTS no disponible en este navegador.");
    return [];
  }

  const voices = window.speechSynthesis.getVoices() || [];
  const sorted = sortVoices(voices);
  ttsStatus.voicesAvailable = sorted.length > 0;
  if (!sorted.length && ttsStatus.mode !== "audio") {
    setStatus("none", "No hay voces del sistema disponibles.");
  }
  return sorted;
}

export function onVoicesChanged(handler) {
  voicesChangedHandlers.push(handler);

  if (!hasWebSpeech) {
    return;
  }

  window.speechSynthesis.onvoiceschanged = () => {
    listVoices();
    notifyVoicesChanged();
  };
}

export async function speak(text, options = {}) {
  stopSpeak();

  const content = String(text || "").trim();
  if (!content) {
    return false;
  }

  const voices = listVoices();
  if (hasWebSpeech && voices.length > 0) {
    const utterance = new SpeechSynthesisUtterance(content);
    const selectedVoice = pickPreferredVoice(voices, options.voice || "");
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    }

    utterance.rate = clamp(options.rate, 0.5, 2.0, 1);
    utterance.pitch = clamp(options.pitch, 0.0, 2.0, 1);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setStatus("web", selectedVoice ? `Voz: ${selectedVoice.name}` : "TTS del navegador activo.");
    return true;
  }

  await loadAudioMap();
  const candidates = getAudioCandidates(options);
  if (candidates.length > 0) {
    const played = await playAudioCandidates(candidates);
    if (played) {
      return true;
    }
  }

  setStatus("none", "TTS no disponible en este navegador.");
  return false;
}

export function stopSpeak() {
  if (hasWebSpeech) {
    window.speechSynthesis.cancel();
  }
  stopActiveAudio();
}

export function pauseSpeak() {
  if (hasWebSpeech) {
    window.speechSynthesis.pause();
  }
  if (activeAudio) {
    activeAudio.pause();
  }
}

export function resumeSpeak() {
  if (hasWebSpeech) {
    window.speechSynthesis.resume();
  }
  if (activeAudio) {
    activeAudio.play().catch(() => {});
  }
}

export function getTtsStatus() {
  listVoices();
  return {
    ...ttsStatus
  };
}
