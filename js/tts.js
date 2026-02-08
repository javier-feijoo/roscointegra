export function listVoices() {
  if (!("speechSynthesis" in window)) {
    return [];
  }
  return window.speechSynthesis.getVoices();
}

export function speak(text, options = {}) {
  if (!("speechSynthesis" in window) || !text) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  if (options.voice) {
    const voice = listVoices().find((v) => v.name === options.voice);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
  }
  utterance.rate = Number(options.rate) || 1;
  utterance.pitch = Number(options.pitch) || 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeak() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function pauseSpeak() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeak() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.resume();
  }
}
