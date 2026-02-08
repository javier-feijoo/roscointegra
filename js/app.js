import { LETTERS, state, initializeGameLetters } from "./state.js";
import {
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  stopTimer,
  getRemainingMs,
  timerIsRunning,
  timerIsPaused,
  formatMMSS
} from "./timer.js";
import { listVoices, speak, stopSpeak, pauseSpeak, resumeSpeak } from "./tts.js";
import { saveJSON, loadJSON } from "./storage.js";

const STORAGE_KEY = "roscointegra.base.config";
const LAST_BANK_KEY = "roscointegra.lastBank.v1";
const MANIFEST_PATH = "./assets/manifest.json";
const FALLBACK_BANK_FILE = "preguntas_base_roscointegra.json";

const refs = {
  rosco: document.getElementById("rosco"),
  assetBankSelect: document.getElementById("assetBankSelect"),
  btnLoadAssetBank: document.getElementById("btnLoadAssetBank"),
  jsonInput: document.getElementById("jsonInput"),
  jsonFile: document.getElementById("jsonFile"),
  btnLoadJson: document.getElementById("btnLoadJson"),
  btnStart: document.getElementById("btnStart"),
  btnNewGame: document.getElementById("btnNewGame"),
  btnTimerPause: document.getElementById("btnTimerPause"),
  btnTimerResume: document.getElementById("btnTimerResume"),
  btnTimerReset: document.getElementById("btnTimerReset"),
  btnOverlayNewGame: document.getElementById("btnOverlayNewGame"),
  btnOverlayResetTime: document.getElementById("btnOverlayResetTime"),
  timeOverlay: document.getElementById("timeOverlay"),
  btnReveal: document.getElementById("btnReveal"),
  btnPass: document.getElementById("btnPass"),
  btnReadAnswer: document.getElementById("btnReadAnswer"),
  btnCorrect: document.getElementById("btnCorrect"),
  btnWrong: document.getElementById("btnWrong"),
  loadStatus: document.getElementById("loadStatus"),
  loadTotal: document.getElementById("loadTotal"),
  loadDuplicates: document.getElementById("loadDuplicates"),
  loadMissing: document.getElementById("loadMissing"),
  loadSource: document.getElementById("loadSource"),
  filterCycle: document.getElementById("filterCycle"),
  filterModule: document.getElementById("filterModule"),
  filterDifficulty: document.getElementById("filterDifficulty"),
  timerDisplay: document.getElementById("timerDisplay"),
  scoreDisplay: document.getElementById("scoreDisplay"),
  activeLetter: document.getElementById("activeLetter"),
  questionText: document.getElementById("questionText"),
  answerBlock: document.getElementById("answerBlock"),
  answerText: document.getElementById("answerText"),
  cfgShuffle: document.getElementById("cfgShuffle"),
  cfgTime: document.getElementById("cfgTime"),
  cfgTimeUnit: document.getElementById("cfgTimeUnit"),
  cfgPoints: document.getElementById("cfgPoints"),
  cfgPenalty: document.getElementById("cfgPenalty"),
  ttsAuto: document.getElementById("ttsAuto"),
  ttsVoice: document.getElementById("ttsVoice"),
  ttsRate: document.getElementById("ttsRate"),
  ttsPitch: document.getElementById("ttsPitch"),
  btnTtsRead: document.getElementById("btnTtsRead"),
  btnTtsStop: document.getElementById("btnTtsStop"),
  btnTtsPause: document.getElementById("btnTtsPause"),
  btnTtsResume: document.getElementById("btnTtsResume")
};

let assetsManifest = null;

async function init() {
  hydrateConfig();
  initializeGameLetters();
  renderRosco();
  renderHUD();
  renderVoices();
  bindEvents();
  hideAnswerAndJudgeButtons();
  hideTimeOverlay();
  syncActionButtons();
  syncTimerButtons();
  await bootstrapAssetsManifest();
  hydrateLastBankMeta();
}

function bindEvents() {
  refs.btnLoadAssetBank.addEventListener("click", handleLoadAssetBank);
  refs.btnLoadJson.addEventListener("click", handleValidateAndLoadFromTextarea);
  refs.jsonFile.addEventListener("change", handleFileLoad);
  refs.btnStart.addEventListener("click", handleStartGame);
  refs.btnNewGame.addEventListener("click", handleNewGame);
  refs.btnTimerPause.addEventListener("click", handlePauseTimer);
  refs.btnTimerResume.addEventListener("click", handleResumeTimer);
  refs.btnTimerReset.addEventListener("click", handleResetTimerButton);
  refs.btnOverlayNewGame.addEventListener("click", handleNewGame);
  refs.btnOverlayResetTime.addEventListener("click", handleResetTimerButton);

  refs.btnReveal.addEventListener("click", () => {
    const active = getActiveLetterState();
    if (!state.game.running || !active || active.status !== "pending" || !active.questionData || state.game.blockedByTime) {
      return;
    }
    state.game.answerRevealed = true;
    refs.answerBlock.classList.remove("hidden");
    refs.answerText.textContent = active.questionData.respuesta;
    refs.btnReadAnswer.classList.remove("hidden");
    refs.btnCorrect.classList.remove("hidden");
    refs.btnWrong.classList.remove("hidden");
    syncActionButtons();
  });

  refs.btnPass.addEventListener("click", onPass);
  refs.btnCorrect.addEventListener("click", onMarkCorrect);
  refs.btnWrong.addEventListener("click", onMarkWrong);
  refs.btnReadAnswer.addEventListener("click", speakCurrentAnswer);

  refs.btnTtsRead.addEventListener("click", speakCurrentQuestion);
  refs.btnTtsStop.addEventListener("click", stopSpeak);
  refs.btnTtsPause.addEventListener("click", pauseSpeak);
  refs.btnTtsResume.addEventListener("click", resumeSpeak);

  refs.cfgShuffle.addEventListener("change", persistConfigFromForm);
  refs.cfgTime.addEventListener("change", persistConfigFromForm);
  refs.cfgTimeUnit.addEventListener("change", persistConfigFromForm);
  refs.cfgPoints.addEventListener("change", persistConfigFromForm);
  refs.cfgPenalty.addEventListener("change", persistConfigFromForm);
  refs.ttsAuto.addEventListener("change", persistConfigFromForm);
  refs.ttsVoice.addEventListener("change", persistConfigFromForm);
  refs.ttsRate.addEventListener("change", persistConfigFromForm);
  refs.ttsPitch.addEventListener("change", persistConfigFromForm);

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = renderVoices;
  }
}

async function bootstrapAssetsManifest() {
  try {
    const response = await fetch(MANIFEST_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`manifest no disponible (${response.status})`);
    }
    const parsed = await response.json();
    assetsManifest = normalizeManifest(parsed);
    renderAssetBankSelect(assetsManifest);
    refs.loadStatus.textContent = "Manifest cargado. Selecciona banco en assets o usa pegado/archivo.";
  } catch (_error) {
    assetsManifest = {
      default: FALLBACK_BANK_FILE,
      banks: [{ id: "base", label: "Banco base (fallback)", file: FALLBACK_BANK_FILE }],
      fallback: true
    };
    renderAssetBankSelect(assetsManifest);
    refs.loadStatus.textContent = "No se pudo leer manifest.json. Se activo fallback a preguntas_base_roscointegra.json.";

    try {
      const fallbackBank = await fetchBankFile(FALLBACK_BANK_FILE);
      refs.jsonInput.value = JSON.stringify(fallbackBank, null, 2);
      applyLoadedBank(fallbackBank, { source: "assets", file: FALLBACK_BANK_FILE });
      refs.loadStatus.textContent = "Manifest no disponible. Banco base cargado por fallback.";
    } catch (fallbackError) {
      refs.loadStatus.textContent = `Manifest no disponible y fallback no utilizable: ${fallbackError.message}`;
      refs.btnStart.disabled = true;
    }
  }
}

function normalizeManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.banks) || manifest.banks.length === 0) {
    throw new Error("manifest invalido");
  }

  const banks = manifest.banks
    .filter((bank) => bank && typeof bank === "object" && bank.file)
    .map((bank) => ({
      id: String(bank.id || bank.file),
      label: String(bank.label || bank.file),
      file: String(bank.file)
    }));

  if (banks.length === 0) {
    throw new Error("manifest sin bancos validos");
  }

  const hasDefault = banks.some((bank) => bank.file === manifest.default);
  return {
    default: hasDefault ? manifest.default : banks[0].file,
    banks,
    fallback: false
  };
}

function renderAssetBankSelect(manifest) {
  refs.assetBankSelect.innerHTML = "";
  manifest.banks.forEach((bank) => {
    const option = document.createElement("option");
    option.value = bank.file;
    option.textContent = bank.label;
    refs.assetBankSelect.appendChild(option);
  });

  refs.assetBankSelect.value = manifest.default;
}

async function handleLoadAssetBank() {
  const file = refs.assetBankSelect.value;
  if (!file) {
    refs.loadStatus.textContent = "Selecciona un banco del selector de assets.";
    return;
  }

  try {
    const bank = await fetchBankFile(file);
    refs.jsonInput.value = JSON.stringify(bank, null, 2);
    applyLoadedBank(bank, { source: "assets", file });
  } catch (error) {
    refs.btnStart.disabled = true;
    refs.loadStatus.textContent = `No se pudo cargar ./assets/${file}: ${error.message}`;

    if (assetsManifest?.fallback) {
      refs.loadStatus.textContent += " Si abres en file://, usa un servidor local o carga por pegado/archivo.";
    }
  }
}

async function fetchBankFile(file) {
  const response = await fetch(`./assets/${file}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function handleValidateAndLoadFromTextarea() {
  const text = refs.jsonInput.value.trim();
  if (!text) {
    refs.loadStatus.textContent = "Pega JSON antes de validar.";
    return;
  }

  try {
    const parsed = JSON.parse(text);
    applyLoadedBank(parsed, { source: "pegado" });
  } catch (error) {
    refs.btnStart.disabled = true;
    refs.loadStatus.textContent = `Error: ${error.message}`;
  }
}

async function handleFileLoad(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await readFileAsText(file);
    refs.jsonInput.value = text;
    const parsed = JSON.parse(text);
    applyLoadedBank(parsed, { source: "archivo", file: file.name });
  } catch (error) {
    refs.btnStart.disabled = true;
    refs.loadStatus.textContent = `Error al leer archivo: ${error.message}`;
  } finally {
    event.target.value = "";
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsText(file);
  });
}

function applyLoadedBank(rawBank, sourceMeta) {
  const { bank, summary } = validateAndNormalizeBank(rawBank);
  state.questionBank = bank;
  refs.btnStart.disabled = false;

  stopTimer();
  state.game.running = false;
  state.game.activeIndex = -1;
  state.game.activeLetter = null;
  state.game.answerRevealed = false;
  state.game.blockedByTime = false;
  state.game.timerPaused = false;

  fillFilterSelects(bank.questions);
  renderLoadState(summary, sourceMeta);
  renderRosco();
  renderActiveQuestionPanel();
  hideAnswerAndJudgeButtons();
  hideTimeOverlay();
  state.game.timeLeft = getConfiguredTotalSeconds();
  renderHUD();
  syncActionButtons();
  syncTimerButtons();

  refs.loadStatus.textContent = summary.missingLetters.length > 0
    ? `Banco valido con advertencias. Faltan letras: ${summary.missingLetters.join(", ")}`
    : "Banco valido y cargado.";

  saveJSON(LAST_BANK_KEY, {
    source: sourceMeta.source,
    file: sourceMeta.file || "",
    loadedAt: new Date().toISOString(),
    totalQuestions: summary.total
  });
}

function validateAndNormalizeBank(rawBank) {
  if (!rawBank || typeof rawBank !== "object" || !Array.isArray(rawBank.preguntas)) {
    throw new Error("El JSON debe incluir preguntas[] (formato base RoscoIntegra)");
  }

  const normalized = [];
  const seenLetters = new Set();
  const seenQuestionKey = new Set();
  const duplicateQuestionKeys = new Set();

  rawBank.preguntas.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`preguntas[${index}] no es un objeto valido`);
    }

    const letra = String(item.letra || "").trim().toUpperCase();
    const tipo = String(item.tipo || "").trim();
    const pregunta = String(item.pregunta || "").trim();
    const respuesta = String(item.respuesta || "").trim();

    if (!LETTERS.includes(letra)) {
      throw new Error(`preguntas[${index}].letra invalida: ${letra || "(vacia)"}`);
    }
    if (!tipo) {
      throw new Error(`preguntas[${index}].tipo es obligatorio`);
    }
    if (!pregunta) {
      throw new Error(`preguntas[${index}].pregunta es obligatoria`);
    }
    if (!respuesta) {
      throw new Error(`preguntas[${index}].respuesta es obligatoria`);
    }

    seenLetters.add(letra);
    const key = `${letra}|${pregunta.toLowerCase()}|${respuesta.toLowerCase()}`;
    if (seenQuestionKey.has(key)) {
      duplicateQuestionKeys.add(key);
    }
    seenQuestionKey.add(key);

    normalized.push({
      ...item,
      letra,
      tipo,
      pregunta,
      respuesta,
      ciclo: String(item.ciclo || ""),
      modulo: String(item.modulo || ""),
      dificultad: String(item.dificultad || "")
    });
  });

  const missingLetters = LETTERS.filter((letter) => !seenLetters.has(letter));

  return {
    bank: {
      ...rawBank,
      preguntas: normalized,
      questions: normalized
    },
    summary: {
      total: normalized.length,
      duplicateLetters: duplicateQuestionKeys.size > 0 ? ["SI"] : [],
      missingLetters
    }
  };
}

function renderLoadState(summary, sourceMeta) {
  refs.loadTotal.textContent = String(summary.total);
  refs.loadDuplicates.textContent = summary.duplicateLetters.length > 0 ? "SI" : "No";
  refs.loadMissing.textContent = summary.missingLetters.length > 0
    ? summary.missingLetters.join(", ")
    : "No";

  refs.loadSource.textContent = sourceMeta.file
    ? `${sourceMeta.source}:${sourceMeta.file}`
    : sourceMeta.source;
}

function fillFilterSelects(questions) {
  const ciclos = uniqueSorted(questions.map((item) => item.ciclo));
  const modulos = uniqueSorted(questions.map((item) => item.modulo));
  const dificultades = uniqueSorted(questions.map((item) => item.dificultad));

  fillSelect(refs.filterCycle, ciclos, "Todos los ciclos");
  fillSelect(refs.filterModule, modulos, "Todos los modulos");
  fillSelect(refs.filterDifficulty, dificultades, "Todas las dificultades");
}

function fillSelect(select, values, defaultLabel) {
  select.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultLabel;
  select.appendChild(defaultOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

function hydrateLastBankMeta() {
  const lastBank = loadJSON(LAST_BANK_KEY, null);
  if (!lastBank) {
    return;
  }

  if (lastBank.source === "assets" && lastBank.file) {
    const hasOption = Array.from(refs.assetBankSelect.options).some((opt) => opt.value === lastBank.file);
    if (hasOption) {
      refs.assetBankSelect.value = lastBank.file;
    }
  }

  if (lastBank.source && refs.loadSource.textContent === "-") {
    refs.loadSource.textContent = lastBank.file ? `${lastBank.source}:${lastBank.file}` : lastBank.source;
  }
}

function handleStartGame() {
  if (!state.questionBank?.questions?.length) {
    refs.loadStatus.textContent = "No hay banco cargado. Carga preguntas antes de empezar.";
    return;
  }

  persistConfigFromForm();

  const filteredQuestions = getFilteredQuestions(state.questionBank.questions);
  if (filteredQuestions.length === 0) {
    refs.loadStatus.textContent = "Los filtros dejan 0 preguntas. Ajusta ciclo/modulo/dificultad.";
    return;
  }

  const { letters, selectedByLetter, poolByLetter } = buildGameSetByLetter(filteredQuestions, state.config.shuffle);
  const firstPendingIndex = letters.findIndex((item) => item.status === "pending");

  if (firstPendingIndex === -1) {
    refs.loadStatus.textContent = "No hay letras jugables con los filtros actuales.";
    return;
  }

  state.game.letters = letters;
  state.game.selectedByLetter = selectedByLetter;
  state.game.poolByLetter = poolByLetter;
  state.game.activeIndex = firstPendingIndex;
  state.game.activeLetter = letters[firstPendingIndex].letra;
  state.game.score = 0;
  state.game.pointsPerCorrect = state.config.pointsCorrect;
  state.game.timeLeft = getConfiguredTotalSeconds();
  state.game.running = true;
  state.game.answerRevealed = false;
  state.game.blockedByTime = false;
  state.game.timerPaused = false;

  hideTimeOverlay();
  hideAnswerAndJudgeButtons();
  syncActionButtons();

  renderRosco();
  renderHUD();
  enterLetter(firstPendingIndex);

  startGlobalCountdown(getConfiguredTotalMs());
}

function getFilteredQuestions(allQuestions) {
  const cycle = normalizeFilterValue(refs.filterCycle.value);
  const moduleValue = normalizeFilterValue(refs.filterModule.value);
  const difficulty = normalizeFilterValue(refs.filterDifficulty.value);

  return allQuestions.filter((item) => {
    const byCycle = !cycle || normalizeFilterValue(item.ciclo) === cycle;
    const byModule = !moduleValue || normalizeFilterValue(item.modulo) === moduleValue;
    const byDifficulty = !difficulty || normalizeFilterValue(item.dificultad) === difficulty;
    return byCycle && byModule && byDifficulty;
  });
}

function normalizeFilterValue(value) {
  const clean = String(value || "").trim();
  return clean === "" ? "" : clean.toLocaleLowerCase("es");
}

function buildGameSetByLetter(filteredQuestions, shuffleEnabled) {
  const poolByLetter = Object.fromEntries(LETTERS.map((letra) => [letra, []]));
  filteredQuestions.forEach((question) => {
    poolByLetter[question.letra].push(question);
  });

  const selectedByLetter = {};
  const letters = LETTERS.map((letra) => {
    const pool = poolByLetter[letra];
    if (!pool || pool.length === 0) {
      return {
        letra,
        status: "disabled",
        questionData: null
      };
    }

    const picked = shuffleEnabled ? pool[Math.floor(Math.random() * pool.length)] : pool[0];
    selectedByLetter[letra] = picked;
    return {
      letra,
      status: "pending",
      questionData: picked
    };
  });

  return {
    letters,
    selectedByLetter,
    poolByLetter
  };
}

function getActiveLetterState() {
  if (state.game.activeIndex < 0 || state.game.activeIndex >= state.game.letters.length) {
    return null;
  }
  return state.game.letters[state.game.activeIndex] || null;
}

function renderActiveQuestionPanel() {
  const active = getActiveLetterState();

  if (!active || active.status !== "pending" || !active.questionData) {
    refs.activeLetter.textContent = "-";
    refs.questionText.textContent = "No hay letra activa jugable.";
    refs.answerBlock.classList.add("hidden");
    refs.answerText.textContent = "";
    return;
  }

  refs.activeLetter.textContent = active.letra;
  refs.questionText.textContent = active.questionData.pregunta;
  refs.answerText.textContent = active.questionData.respuesta;
}

function renderRosco() {
  refs.rosco.innerHTML = "";
  const step = 360 / LETTERS.length;

  LETTERS.forEach((letter, index) => {
    const node = document.createElement("li");
    const letterState = state.game.letters[index] || { status: "disabled" };

    node.textContent = letter;
    node.style.setProperty("--angle", `${step * index}deg`);
    node.classList.add(letterState.status || "disabled");

    if (state.game.activeIndex === index && letterState.status === "pending") {
      node.classList.add("active");
    }

    refs.rosco.appendChild(node);
  });
}

function renderHUD() {
  refs.timerDisplay.textContent = formatMMSS(state.game.timeLeft);
  refs.scoreDisplay.textContent = String(state.game.score);
}

function renderVoices() {
  const voices = listVoices();
  refs.ttsVoice.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Predeterminada";
  refs.ttsVoice.appendChild(defaultOption);

  voices.forEach((voice) => {
    const opt = document.createElement("option");
    opt.value = voice.name;
    opt.textContent = `${voice.name} (${voice.lang})`;
    refs.ttsVoice.appendChild(opt);
  });

  refs.ttsVoice.value = state.config.tts.voice;
}

function speakCurrentQuestion() {
  const active = getActiveLetterState();
  if (!active?.questionData) {
    return;
  }

  speak(`Letra ${active.letra}. ${active.questionData.pregunta}`, {
    voice: refs.ttsVoice.value,
    rate: Number(refs.ttsRate.value) || 1,
    pitch: Number(refs.ttsPitch.value) || 1
  });
}

function onPass() {
  if (!state.game.running || state.game.blockedByTime) {
    return;
  }
  const active = getActiveLetterState();
  if (!active || active.status !== "pending") {
    return;
  }
  moveToNextPending();
}

function onMarkCorrect() {
  if (!state.game.running || !state.game.answerRevealed || state.game.blockedByTime) {
    return;
  }
  const active = getActiveLetterState();
  if (!active || active.status !== "pending") {
    return;
  }

  active.status = "correct";
  state.game.score += state.game.pointsPerCorrect;
  renderHUD();
  renderRosco();
  hideAnswerAndJudgeButtons();
  moveToNextPending();
}

function onMarkWrong() {
  if (!state.game.running || !state.game.answerRevealed || state.game.blockedByTime) {
    return;
  }
  const active = getActiveLetterState();
  if (!active || active.status !== "pending") {
    return;
  }

  active.status = "wrong";
  renderRosco();
  hideAnswerAndJudgeButtons();
  moveToNextPending();
}

function moveToNextPending() {
  const nextIndex = findNextPendingIndex(state.game.activeIndex);
  if (nextIndex === -1) {
    endGame("No quedan letras pendientes.");
    return;
  }
  enterLetter(nextIndex);
}

function findNextPendingIndex(fromIndex) {
  if (!state.game.letters.length) {
    return -1;
  }
  for (let offset = 1; offset <= state.game.letters.length; offset += 1) {
    const idx = (fromIndex + offset) % state.game.letters.length;
    if (state.game.letters[idx].status === "pending") {
      return idx;
    }
  }
  return -1;
}

function enterLetter(index) {
  state.game.activeIndex = index;
  state.game.activeLetter = state.game.letters[index]?.letra || null;
  state.game.answerRevealed = false;

  hideAnswerAndJudgeButtons();
  renderRosco();
  renderActiveQuestionPanel();
  syncActionButtons();
  speakCurrentQuestion();
}

function hideAnswerAndJudgeButtons() {
  refs.answerBlock.classList.add("hidden");
  refs.btnReadAnswer.classList.add("hidden");
  refs.btnCorrect.classList.add("hidden");
  refs.btnWrong.classList.add("hidden");
}

function endGame(reason) {
  state.game.running = false;
  state.game.answerRevealed = false;
  state.game.activeIndex = -1;
  state.game.activeLetter = null;
  state.game.timerPaused = false;
  stopTimer();
  hideAnswerAndJudgeButtons();
  syncActionButtons();
  syncTimerButtons();
  renderRosco();
  refs.activeLetter.textContent = "-";
  refs.questionText.textContent = reason;
}

function syncActionButtons() {
  const active = getActiveLetterState();
  const canPlay = state.game.running && !state.game.blockedByTime && !!active && active.status === "pending";
  const canReadAnswer = canPlay && state.game.answerRevealed;
  refs.btnReveal.disabled = !canPlay;
  refs.btnPass.disabled = !canPlay;
  refs.btnReadAnswer.disabled = !canReadAnswer;
  refs.btnCorrect.disabled = !canPlay || !state.game.answerRevealed;
  refs.btnWrong.disabled = !canPlay || !state.game.answerRevealed;
}

function syncTimerButtons() {
  const activeGame = state.game.running && !state.game.blockedByTime;
  refs.btnTimerPause.disabled = !activeGame || !timerIsRunning() || timerIsPaused();
  refs.btnTimerResume.disabled = !activeGame || !timerIsRunning() || !timerIsPaused();
  refs.btnTimerReset.disabled = false;
}

function speakCurrentAnswer() {
  const active = getActiveLetterState();
  if (!active?.questionData || !state.game.answerRevealed) {
    return;
  }

  speak(active.questionData.respuesta, {
    voice: refs.ttsVoice.value,
    rate: Number(refs.ttsRate.value) || 1,
    pitch: Number(refs.ttsPitch.value) || 1
  });
}

function handlePauseTimer() {
  if (!timerIsRunning() || timerIsPaused() || !state.game.running || state.game.blockedByTime) {
    return;
  }
  pauseTimer();
  state.game.timerPaused = true;
  updateTimeFromMs(getRemainingMs());
  syncTimerButtons();
}

function handleResumeTimer() {
  if (!timerIsRunning() || !timerIsPaused() || !state.game.running || state.game.blockedByTime) {
    return;
  }
  resumeTimer();
  state.game.timerPaused = false;
  syncTimerButtons();
}

function handleResetTimerButton() {
  const totalMs = getConfiguredTotalMs();

  hideTimeOverlay();
  state.game.blockedByTime = false;

  if (state.game.letters.length > 0 && state.game.activeIndex >= 0) {
    state.game.running = true;
    state.game.timerPaused = false;
    startGlobalCountdown(totalMs);
    syncActionButtons();
    return;
  }

  stopTimer();
  resetTimer(totalMs);
  updateTimeFromMs(totalMs);
  state.game.running = false;
  state.game.timerPaused = false;
  syncActionButtons();
  syncTimerButtons();
}

function handleNewGame() {
  stopTimer();
  initializeGameLetters();
  state.game.running = false;
  state.game.score = 0;
  state.game.answerRevealed = false;
  state.game.blockedByTime = false;
  state.game.timerPaused = false;
  state.game.timeLeft = getConfiguredTotalSeconds();

  hideTimeOverlay();
  hideAnswerAndJudgeButtons();
  renderRosco();
  renderHUD();
  refs.activeLetter.textContent = "-";
  refs.questionText.textContent = 'Pulsa "Empezar partida" para iniciar.';
  refs.answerText.textContent = "";
  syncActionButtons();
  syncTimerButtons();
}

function startGlobalCountdown(totalMs) {
  startTimer(
    totalMs,
    (remainingMs) => {
      updateTimeFromMs(remainingMs);
    },
    () => {
      handleTimeElapsed();
    }
  );
  state.game.timerPaused = false;
  syncTimerButtons();
}

function updateTimeFromMs(remainingMs) {
  state.game.timeLeft = Math.max(0, Math.ceil((Number(remainingMs) || 0) / 1000));
  renderHUD();
}

function handleTimeElapsed() {
  state.game.timeLeft = 0;
  state.game.blockedByTime = true;
  state.game.running = false;
  state.game.timerPaused = false;
  stopSpeak();
  renderHUD();
  showTimeOverlay();
  syncActionButtons();
  syncTimerButtons();
}

function showTimeOverlay() {
  refs.timeOverlay.classList.remove("hidden");
}

function hideTimeOverlay() {
  refs.timeOverlay.classList.add("hidden");
}

function getConfiguredTotalSeconds() {
  const amount = Math.max(1, Number.parseInt(refs.cfgTime.value, 10) || 1);
  const unit = refs.cfgTimeUnit.value === "minutes" ? "minutes" : "seconds";
  return unit === "minutes" ? amount * 60 : amount;
}

function getConfiguredTotalMs() {
  return getConfiguredTotalSeconds() * 1000;
}

function persistConfigFromForm() {
  state.config.shuffle = refs.cfgShuffle.checked;
  state.config.totalTime = Math.max(1, Number.parseInt(refs.cfgTime.value, 10) || 1);
  state.config.timeUnit = refs.cfgTimeUnit.value === "minutes" ? "minutes" : "seconds";
  state.config.pointsCorrect = Number(refs.cfgPoints.value) || 0;
  state.config.penaltyWrong = Number(refs.cfgPenalty.value) || 0;
  state.config.tts.auto = refs.ttsAuto.checked;
  state.config.tts.voice = refs.ttsVoice.value;
  state.config.tts.rate = Number(refs.ttsRate.value) || 1;
  state.config.tts.pitch = Number(refs.ttsPitch.value) || 1;
  saveJSON(STORAGE_KEY, state.config);

  if (!state.game.running && !timerIsRunning()) {
    state.game.timeLeft = getConfiguredTotalSeconds();
    renderHUD();
  }
}

function hydrateConfig() {
  const saved = loadJSON(STORAGE_KEY, state.config);
  state.config = {
    ...state.config,
    ...saved,
    tts: {
      ...state.config.tts,
      ...(saved?.tts || {})
    }
  };

  refs.cfgShuffle.checked = state.config.shuffle;
  refs.cfgTime.value = String(state.config.totalTime);
  refs.cfgTimeUnit.value = state.config.timeUnit === "minutes" ? "minutes" : "seconds";
  refs.cfgPoints.value = String(state.config.pointsCorrect);
  refs.cfgPenalty.value = String(state.config.penaltyWrong);
  refs.ttsAuto.checked = state.config.tts.auto;
  refs.ttsRate.value = String(state.config.tts.rate);
  refs.ttsPitch.value = String(state.config.tts.pitch);
  state.game.timeLeft = getConfiguredTotalSeconds();
}

init().catch((error) => {
  refs.loadStatus.textContent = `Error de inicializacion: ${error.message}`;
});
