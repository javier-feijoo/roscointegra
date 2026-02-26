
import { state, initializeGameLetters } from "./state.js";
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
import { listVoices, speak, stopSpeak, pauseSpeak, resumeSpeak, onVoicesChanged, getTtsStatus } from "./tts.js";
import { saveJSON, loadJSON, removeItem } from "./storage.js";
import { validateAndNormalizeBank, buildGameSetByLetter } from "./bank.js";
import { renderRoscoCircle } from "./rosco.js";
import { playCorrectSfx, playWrongSfx, playCountdownTickSfx, playTimeUpSfx } from "./sfx.js";
import { t, setLanguage, getLanguage } from "./i18n.js";

const CONFIG_KEY = "roscointegra.config.v2";
const BANK_CACHE_KEY = "roscointegra.bank.cache.v2";
const MANIFEST_KEY = "roscointegra.assets.manifest.v1";
const SCORES_KEY = "roscointegra.scores.v1";
const DEFAULT_BANK_FILE = "preguntas_base_roscointegra.json";
const MANIFEST_CANDIDATES = ["./assets/manifest.json", "assets/manifest.json", "/assets/manifest.json"];

const DEFAULT_CONFIG = {
  playerName: "",
  shuffle: true,
  totalTime: 180,
  timeUnit: "seconds",
  pointsCorrect: 10,
  penaltyWrong: 0,
  audioEnabled: true,
  filters: { cycle: "", module: "", difficulty: "" },
  ui: { teacherMode: false },
  tts: { voice: "", rate: 1, pitch: 1 }
};

const refs = {
  viewLanding: document.getElementById("viewLanding"),
  viewConfig: document.getElementById("viewConfig"),
  viewGame: document.getElementById("viewGame"),
  langSelect: document.getElementById("lang-select"),
  playerNameInput: document.getElementById("playerNameInput"),
  currentPlayerName: document.getElementById("currentPlayerName"),
  btnViewTopScores: document.getElementById("btnViewTopScores"),
  topScoresList: document.getElementById("topScoresList"),
  btnClearTopScores: document.getElementById("btnClearTopScores"),
  topScoresEmpty: document.getElementById("topScoresEmpty"),
  btnGoConfig: document.getElementById("btnGoConfig"),
  btnLandingStart: document.getElementById("btnLandingStart"),
  landingStartHint: document.getElementById("landingStartHint"),
  landingBankOrigin: document.getElementById("landingBankOrigin"),
  landingBankFile: document.getElementById("landingBankFile"),
  landingBankCount: document.getElementById("landingBankCount"),
  btnBackToLanding: document.getElementById("btnBackToLanding"),
  assetBankSelect: document.getElementById("assetBankSelect"),
  btnLoadAssetBank: document.getElementById("btnLoadAssetBank"),
  jsonInput: document.getElementById("jsonInput"),
  btnLoadJson: document.getElementById("btnLoadJson"),
  jsonFile: document.getElementById("jsonFile"),
  loadSource: document.getElementById("loadSource"),
  loadFile: document.getElementById("loadFile"),
  loadTotal: document.getElementById("loadTotal"),
  loadDuplicates: document.getElementById("loadDuplicates"),
  loadMissing: document.getElementById("loadMissing"),
  loadStatus: document.getElementById("loadStatus"),
  diagnosticLog: document.getElementById("diagnosticLog"),
  cfgTime: document.getElementById("cfgTime"),
  cfgTimeUnit: document.getElementById("cfgTimeUnit"),
  cfgPoints: document.getElementById("cfgPoints"),
  cfgPenalty: document.getElementById("cfgPenalty"),
  cfgShuffle: document.getElementById("cfgShuffle"),
  cfgAudioEnabled: document.getElementById("cfgAudioEnabled"),
  filterCycle: document.getElementById("filterCycle"),
  filterModule: document.getElementById("filterModule"),
  filterDifficulty: document.getElementById("filterDifficulty"),
  ttsStatus: document.getElementById("ttsStatus"),
  ttsVoice: document.getElementById("ttsVoice"),
  ttsRate: document.getElementById("ttsRate"),
  ttsPitch: document.getElementById("ttsPitch"),
  cfgTeacherMode: document.getElementById("cfgTeacherMode"),
  btnSaveConfig: document.getElementById("btnSaveConfig"),
  btnStartFromConfig: document.getElementById("btnStartFromConfig"),
  btnResetConfig: document.getElementById("btnResetConfig"),
  configStatus: document.getElementById("configStatus"),
  gameContainer: document.getElementById("gameContainer"),
  timerDisplay: document.getElementById("timerDisplay"),
  scoreDisplay: document.getElementById("scoreDisplay"),
  btnTimerPause: document.getElementById("btnTimerPause"),
  btnTimerResume: document.getElementById("btnTimerResume"),
  btnTimerReset: document.getElementById("btnTimerReset"),
  btnFullscreen: document.getElementById("btnFullscreen"),
  btnNewGame: document.getElementById("btnNewGame"),
  btnExitToLanding: document.getElementById("btnExitToLanding"),
  rosco: document.getElementById("rosco"),
  activeLetter: document.getElementById("activeLetter"),
  questionText: document.getElementById("questionText"),
  answerBlock: document.getElementById("answerBlock"),
  answerText: document.getElementById("answerText"),
  btnReveal: document.getElementById("btnReveal"),
  btnPass: document.getElementById("btnPass"),
  btnReadQuestion: document.getElementById("btnReadQuestion"),
  btnReadAnswer: document.getElementById("btnReadAnswer"),
  btnCorrect: document.getElementById("btnCorrect"),
  btnWrong: document.getElementById("btnWrong"),
  btnTtsStop: document.getElementById("btnTtsStop"),
  btnTtsPause: document.getElementById("btnTtsPause"),
  btnTtsResume: document.getElementById("btnTtsResume"),
  teacherPanel: document.getElementById("teacherPanel"),
  teacherStateText: document.getElementById("teacherStateText"),
  summaryOverlay: document.getElementById("summaryOverlay"),
  summaryTitle: document.getElementById("summaryTitle"),
  summaryReason: document.getElementById("summaryReason"),
  summaryPlayerName: document.getElementById("summaryPlayerName"),
  summaryScore: document.getElementById("summaryScore"),
  summaryPercent: document.getElementById("summaryPercent"),
  summaryCorrect: document.getElementById("summaryCorrect"),
  summaryWrong: document.getElementById("summaryWrong"),
  summaryPassed: document.getElementById("summaryPassed"),
  summaryTimeLeft: document.getElementById("summaryTimeLeft"),
  summaryTimeUsed: document.getElementById("summaryTimeUsed"),
  btnExportResults: document.getElementById("btnExportResults"),
  btnOverlayNewGame: document.getElementById("btnOverlayNewGame"),
  btnOverlayExit: document.getElementById("btnOverlayExit"),
  topScoresOverlay: document.getElementById("topScoresOverlay"),
  btnCloseTopScores: document.getElementById("btnCloseTopScores")
};

let assetsManifest = { default: DEFAULT_BANK_FILE, banks: [{ id: "base", label: "Banco base", file: DEFAULT_BANK_FILE }] };
let latestSummary = null;
let diagnosticLines = [];
let lastCountdownTickSecond = null;

async function init() {
  await setLanguage(getLanguage());
  bindEvents();
  hydrateConfig();
  refs.langSelect.value = getLanguage();
  initializeGameLetters([]);
  renderRosco();
  renderHUD();
  renderVoices();
  syncAudioUi();
  syncActionButtons();
  syncTimerButtons();
  syncTeacherModeUi();
  updateTtsStatus();
  await bootstrapAssetsAndBank();
  renderCurrentPlayer();
  renderTopScores();
  updateBankInfoUI();
  refreshLandingStartState();
  switchView("landing");
}

function bindEvents() {
  refs.langSelect.addEventListener("change", async (event) => {
    await setLanguage(event.target.value || "es");
    renderVoices();
    if (state.questionBank?.questions?.length) {
      fillFilterSelects(state.questionBank.questions);
    }
    renderTopScores();
    renderCurrentPlayer();
    refreshLandingStartState();
    updateTtsStatus();
    if (latestSummary) {
      renderSummary(latestSummary);
    }
  });

  refs.playerNameInput.addEventListener("input", persistConfigFromForm);
  refs.btnViewTopScores.addEventListener("click", showTopScoresOverlay);
  refs.btnClearTopScores.addEventListener("click", handleClearTopScores);
  refs.btnCloseTopScores.addEventListener("click", hideTopScoresOverlay);
  refs.topScoresOverlay.addEventListener("click", (event) => {
    if (event.target === refs.topScoresOverlay) {
      hideTopScoresOverlay();
    }
  });
  document.addEventListener("roscointegra:language-changed", () => {
    if (!state.game.running && state.ui.view === "game") {
      refs.questionText.textContent = t("questionIdle");
    }
  });

  refs.btnGoConfig.addEventListener("click", () => switchView("config"));
  refs.btnBackToLanding.addEventListener("click", () => {
    persistConfigFromForm();
    switchView("landing");
  });

  refs.btnLandingStart.addEventListener("click", async () => {
    if (await ensureReadyForStart()) {
      startGame();
    } else {
      refreshLandingStartState();
    }
  });

  refs.btnLoadAssetBank.addEventListener("click", async () => { await handleLoadAssetBank(); });
  refs.btnLoadJson.addEventListener("click", handleValidateAndLoadFromTextarea);
  refs.jsonFile.addEventListener("change", handleFileLoad);

  refs.btnSaveConfig.addEventListener("click", () => {
    persistConfigFromForm();
    refs.configStatus.textContent = t("configSaved");
    refreshLandingStartState();
    switchView("landing");
  });

  refs.btnStartFromConfig.addEventListener("click", async () => {
    persistConfigFromForm();
    if (await ensureReadyForStart()) {
      startGame();
    }
  });

  refs.btnResetConfig.addEventListener("click", handleResetConfig);
  refs.btnReveal.addEventListener("click", handleReveal);
  refs.btnPass.addEventListener("click", onPass);
  refs.btnCorrect.addEventListener("click", onMarkCorrect);
  refs.btnWrong.addEventListener("click", onMarkWrong);
  refs.btnReadQuestion.addEventListener("click", speakCurrentQuestion);
  refs.btnReadAnswer.addEventListener("click", speakCurrentAnswer);
  refs.btnTtsStop.addEventListener("click", () => stopSpeak());
  refs.btnTtsPause.addEventListener("click", () => { if (state.config.audioEnabled) pauseSpeak(); });
  refs.btnTtsResume.addEventListener("click", () => { if (state.config.audioEnabled) resumeSpeak(); });

  refs.btnTimerPause.addEventListener("click", handlePauseTimer);
  refs.btnTimerResume.addEventListener("click", handleResumeTimer);
  refs.btnTimerReset.addEventListener("click", handleResetTimer);
  refs.btnFullscreen.addEventListener("click", handleFullscreen);
  refs.btnNewGame.addEventListener("click", handleNewGame);
  refs.btnExitToLanding.addEventListener("click", handleExitToLanding);

  refs.btnExportResults.addEventListener("click", exportResultsJson);
  refs.btnOverlayNewGame.addEventListener("click", handleNewGame);
  refs.btnOverlayExit.addEventListener("click", handleExitToLanding);

  refs.cfgTime.addEventListener("input", persistConfigFromForm);
  refs.cfgTimeUnit.addEventListener("change", persistConfigFromForm);
  refs.cfgPoints.addEventListener("input", persistConfigFromForm);
  refs.cfgPenalty.addEventListener("input", persistConfigFromForm);
  refs.cfgShuffle.addEventListener("change", persistConfigFromForm);
  refs.cfgAudioEnabled.addEventListener("change", persistConfigFromForm);
  refs.filterCycle.addEventListener("change", persistConfigFromForm);
  refs.filterModule.addEventListener("change", persistConfigFromForm);
  refs.filterDifficulty.addEventListener("change", persistConfigFromForm);
  refs.ttsVoice.addEventListener("change", persistConfigFromForm);
  refs.ttsRate.addEventListener("input", persistConfigFromForm);
  refs.ttsPitch.addEventListener("input", persistConfigFromForm);
  refs.cfgTeacherMode.addEventListener("change", persistConfigFromForm);

  onVoicesChanged(() => {
    renderVoices();
    updateTtsStatus();
  });

  document.addEventListener("keydown", handleShortcuts);
  window.addEventListener("resize", () => {
    renderRosco();
  });
}

function switchView(view) {
  state.ui.view = view;
  document.body.classList.toggle("in-game", view === "game");
  refs.viewLanding.classList.toggle("hidden", view !== "landing");
  refs.viewConfig.classList.toggle("hidden", view !== "config");
  refs.viewGame.classList.toggle("hidden", view !== "game");

  if (view === "game") {
    window.requestAnimationFrame(() => {
      renderRosco();
      window.requestAnimationFrame(() => {
        renderRosco();
      });
    });
  }
}

function addDiagnostic(message, level = "info", error = null) {
  const ts = new Date().toLocaleTimeString("es-ES", { hour12: false });
  const line = `[${ts}] [${level.toUpperCase()}] ${message}`;
  diagnosticLines.unshift(line);
  diagnosticLines = diagnosticLines.slice(0, 50);
  refs.diagnosticLog.textContent = diagnosticLines.join("\n");

  if (level === "error") {
    console.error(`[RoscoIntegra] ${message}`, error || "");
  } else {
    console.log(`[RoscoIntegra] ${message}`);
  }
}

async function bootstrapAssetsAndBank() {
  addDiagnostic("Paso 1/5: Cargar manifest de /assets");
  assetsManifest = await loadManifestWithFallback();
  renderAssetBankSelect();

  addDiagnostic("Paso 2/5: Intentar restaurar banco cacheado");
  const cached = loadJSON(BANK_CACHE_KEY, null);
  if (cached?.bank) {
    try {
      applyLoadedBank(cached.bank, {
        source: cached.meta?.source || "cache",
        file: cached.meta?.file || "(cache)",
        totalQuestions: cached.meta?.totalQuestions || cached.bank.preguntas?.length || 0
      }, { persist: false, statusMessage: t("bankRestoredFromCache") });
      refs.jsonInput.value = JSON.stringify(cached.bank, null, 2);
      addDiagnostic("Banco restaurado desde localStorage.");
      return;
    } catch (error) {
      addDiagnostic(`El banco cacheado no es valido: ${error.message}`, "error", error);
    }
  }

  addDiagnostic("Paso 3/5: Intentar cargar banco por defecto desde /assets");
  try {
    await loadBankFromAssetsFile(assetsManifest.default, { statusPrefix: t("defaultBankLoaded") });
    addDiagnostic(`Banco por defecto cargado: ${assetsManifest.default}`);
  } catch (error) {
    const protocolHint = window.location.protocol === "file:"
      ? t("assetsNeedServerHint")
      : t("assetsCheckPathsHint");

    refs.loadStatus.textContent = `${t("defaultBankLoadFailed")} ${protocolHint}\n${t("detailLabel")}: ${error.message}`;
    addDiagnostic(`Fallo al cargar banco por defecto: ${error.message}`, "error", error);
  }
}

async function loadManifestWithFallback() {
  try {
    const manifest = await fetchJSONWithCandidates(MANIFEST_CANDIDATES, "manifest");
    const normalized = normalizeManifest(manifest);
    saveJSON(MANIFEST_KEY, normalized);
    addDiagnostic(`Manifest cargado con ${normalized.banks.length} banco(s).`);
    return normalized;
  } catch (error) {
    addDiagnostic(`No se pudo cargar manifest.json: ${error.message}`, "error", error);
    const saved = loadJSON(MANIFEST_KEY, null);
    if (saved?.banks?.length) {
      addDiagnostic("Se usara manifest guardado en localStorage.", "warn");
      return saved;
    }
    const fallback = { default: DEFAULT_BANK_FILE, banks: [{ id: "base", label: "Banco base (fallback)", file: DEFAULT_BANK_FILE }] };
    addDiagnostic("Se aplico manifest fallback interno.", "warn");
    return fallback;
  }
}

function normalizeManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.banks) || manifest.banks.length === 0) {
    throw new Error("manifest invalido: falta banks[]");
  }

  const banks = manifest.banks
    .filter((item) => item && typeof item === "object" && item.file)
    .map((item) => ({ id: String(item.id || item.file), label: String(item.label || item.file), file: String(item.file) }));

  if (banks.length === 0) {
    throw new Error("manifest invalido: no hay bancos validos");
  }

  const fallbackDefault = String(manifest.default || banks[0].file);
  const defaultFile = banks.some((b) => b.file === fallbackDefault) ? fallbackDefault : banks[0].file;
  return { default: defaultFile, banks };
}

function renderAssetBankSelect() {
  refs.assetBankSelect.innerHTML = "";
  assetsManifest.banks.forEach((bank) => {
    const option = document.createElement("option");
    option.value = bank.file;
    option.textContent = bank.label;
    refs.assetBankSelect.appendChild(option);
  });
  refs.assetBankSelect.value = assetsManifest.default;
}

function buildAssetFileCandidates(file) {
  const clean = String(file || "").replace(/^\/+/, "");
  return [`./assets/${clean}`, `assets/${clean}`, `/assets/${clean}`];
}

async function fetchJSONWithCandidates(urls, contextLabel) {
  const attempts = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const parsed = await res.json();
      addDiagnostic(`${contextLabel}: carga correcta desde ${url}`);
      return parsed;
    } catch (error) {
      attempts.push(`${url} -> ${error.message}`);
      addDiagnostic(`${contextLabel}: fallo en ${url}: ${error.message}`, "warn");
    }
  }

  const hint = window.location.protocol === "file:" ? " Posible causa: acceso con file:// bloquea fetch a /assets." : "";
  throw new Error(`No se pudo cargar ${contextLabel}. Intentos: ${attempts.join(" | ")}.${hint}`);
}

async function handleLoadAssetBank() {
  const file = refs.assetBankSelect.value;
  if (!file) {
    refs.loadStatus.textContent = t("selectAssetBank");
    return;
  }

  try {
    await loadBankFromAssetsFile(file, { statusPrefix: "Banco cargado desde /assets" });
  } catch (error) {
    refs.loadStatus.textContent = buildAssetFailureMessage(error);
    addDiagnostic(`Error cargando banco de assets: ${error.message}`, "error", error);
  }
}

async function loadBankFromAssetsFile(file, opts = {}) {
  const raw = await fetchJSONWithCandidates(buildAssetFileCandidates(file), `banco ${file}`);
  refs.jsonInput.value = JSON.stringify(raw, null, 2);
  applyLoadedBank(raw, { source: "assets", file }, { statusMessage: `${opts.statusPrefix || "Banco cargado"}: ${file}` });
}

function buildAssetFailureMessage(error) {
  const base = `${t("assetBankLoadFailed")} ${error.message}`;
  if (window.location.protocol === "file:") {
    return `${base}\n${t("assetsNeedServerHint")}`;
  }
  return `${base}\n${t("assetsCheckPathsHint")}`;
}
function handleValidateAndLoadFromTextarea() {
  const text = refs.jsonInput.value.trim();
  if (!text) {
    refs.loadStatus.textContent = t("pasteJsonBeforeValidate");
    return;
  }

  try {
    const parsed = JSON.parse(text);
    applyLoadedBank(parsed, { source: "pegado", file: "(textarea)" }, { statusMessage: "Banco cargado desde texto pegado." });
  } catch (error) {
    refs.loadStatus.textContent = t("invalidPastedJson", { error: error.message });
    addDiagnostic(t("invalidPastedJson", { error: error.message }), "error", error);
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
    applyLoadedBank(parsed, { source: "archivo", file: file.name }, { statusMessage: `Banco cargado desde archivo: ${file.name}` });
  } catch (error) {
    refs.loadStatus.textContent = t("importFileError", { error: error.message });
    addDiagnostic(`Fallo importando archivo: ${error.message}`, "error", error);
  } finally {
    event.target.value = "";
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(t("fileReadError")));
    reader.readAsText(file);
  });
}

function applyLoadedBank(rawBank, sourceMeta, options = {}) {
  const { bank, summary } = validateAndNormalizeBank(rawBank);

  state.questionBank = bank;
  initializeGameLetters(bank.letras_incluidas || []);
  state.bankMeta = {
    source: sourceMeta.source,
    file: sourceMeta.file || "",
    totalQuestions: summary.total
  };

  fillFilterSelects(bank.questions);
  updateLoadPanel(summary, sourceMeta);
  updateBankInfoUI();

  if (options.persist !== false) {
    saveJSON(BANK_CACHE_KEY, {
      savedAt: new Date().toISOString(),
      meta: state.bankMeta,
      bank
    });
  }

  refs.loadStatus.textContent = options.statusMessage
    || (summary.missingLetters.length > 0
      ? t("bankValidWarnings", { letters: summary.missingLetters.join(", ") })
      : t("bankValidReady"));

  if (Array.isArray(summary.logs) && summary.logs.length > 0) {
    summary.logs.forEach((msg) => addDiagnostic(msg, summary.usedFallback ? "warn" : "info"));
  }

  addDiagnostic(`Banco aplicado desde ${sourceMeta.source}:${sourceMeta.file || "(sin nombre)"} con ${summary.total} preguntas.`);
  refreshLandingStartState();
}

function updateLoadPanel(summary, sourceMeta) {
  refs.loadSource.textContent = sourceMeta.source || "-";
  refs.loadFile.textContent = sourceMeta.file || "-";
  refs.loadTotal.textContent = String(summary.total);
  refs.loadDuplicates.textContent = summary.duplicateCount > 0
    ? t("duplicatesYes", { count: summary.duplicateCount })
    : t("noValue");
  refs.loadMissing.textContent = summary.missingLetters.length > 0 ? summary.missingLetters.join(", ") : t("noValue");
}

function updateBankInfoUI() {
  refs.landingBankOrigin.textContent = state.bankMeta.source || "-";
  refs.landingBankFile.textContent = state.bankMeta.file || "-";
  refs.landingBankCount.textContent = String(state.bankMeta.totalQuestions || 0);
}

function fillFilterSelects(questions) {
  fillSelect(refs.filterCycle, uniqueSorted(questions.map((q) => q.ciclo)), t("allOption"));
  fillSelect(refs.filterModule, uniqueSorted(questions.map((q) => q.modulo)), t("allOption"));
  fillSelect(refs.filterDifficulty, uniqueSorted(questions.map((q) => q.dificultad)), t("allOption"));
  restoreFilterSelections();
}

function fillSelect(select, values, defaultLabel) {
  select.innerHTML = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent = defaultLabel;
  select.appendChild(def);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, getLanguage(), { sensitivity: "base" }));
}

function restoreFilterSelections() {
  const cycle = state.config.filters.cycle || "";
  const moduleValue = state.config.filters.module || "";
  const difficulty = state.config.filters.difficulty || "";
  refs.filterCycle.value = hasOption(refs.filterCycle, cycle) ? cycle : "";
  refs.filterModule.value = hasOption(refs.filterModule, moduleValue) ? moduleValue : "";
  refs.filterDifficulty.value = hasOption(refs.filterDifficulty, difficulty) ? difficulty : "";
}

function hasOption(select, value) {
  return Array.from(select.options).some((opt) => opt.value === value);
}

async function ensureReadyForStart() {
  if (!hasSavedConfig()) {
    refs.configStatus.textContent = t("saveConfigBeforeStart");
    return false;
  }

  if (state.questionBank?.questions?.length) {
    return true;
  }

  const cached = loadJSON(BANK_CACHE_KEY, null);
  if (cached?.bank) {
    try {
      applyLoadedBank(cached.bank, {
        source: cached.meta?.source || "cache",
        file: cached.meta?.file || "(cache)"
      }, { persist: false, statusMessage: t("bankRecoveredFromCache") });
      return true;
    } catch (error) {
      addDiagnostic(`Cache de banco invalida: ${error.message}`, "error", error);
    }
  }

  try {
    await loadBankFromAssetsFile(assetsManifest.default, { statusPrefix: t("defaultBankLoaded") });
    return true;
  } catch (error) {
    refs.configStatus.textContent = buildAssetFailureMessage(error);
    return false;
  }
}

function hasSavedConfig() {
  return !!loadJSON(CONFIG_KEY, null);
}

function refreshLandingStartState() {
  const configOk = hasSavedConfig();
  const bankOk = !!state.questionBank?.questions?.length;
  refs.btnLandingStart.disabled = !(configOk && bankOk);

  if (!configOk) {
    refs.landingStartHint.textContent = t("startDisabledConfig");
    return;
  }
  if (!bankOk) {
    refs.landingStartHint.textContent = window.location.protocol === "file:"
      ? t("startDisabledNoBankFile")
      : t("startDisabledNoBank");
    return;
  }
  refs.landingStartHint.textContent = t("readyToStart");
}

function startGame() {
  if (!state.questionBank?.questions?.length) {
    refs.configStatus.textContent = t("noBankToStart");
    switchView("config");
    return;
  }

  persistConfigFromForm();

  const filtered = getFilteredQuestions(state.questionBank.questions);
  if (filtered.length === 0) {
    refs.configStatus.textContent = t("filtersNoQuestions");
    switchView("config");
    return;
  }

  const letterOrder = Array.isArray(state.questionBank.letras_incluidas) ? state.questionBank.letras_incluidas : [];
  const { letters, selectedByLetter, poolByLetter } = buildGameSetByLetter(letterOrder, filtered, state.config.shuffle);
  const firstPending = letters.findIndex((x) => x.status === "pending");
  if (firstPending === -1) {
    refs.configStatus.textContent = t("noPlayableLetters");
    switchView("config");
    return;
  }

  state.game.letters = letters;
  state.game.selectedByLetter = selectedByLetter;
  state.game.poolByLetter = poolByLetter;
  state.game.activeIndex = firstPending;
  state.game.activeLetter = letters[firstPending].letra;
  state.game.answerRevealed = false;
  state.game.running = true;
  state.game.blockedByTime = false;
  state.game.timerPaused = false;
  state.game.score = 0;
  state.game.pointsPerCorrect = state.config.pointsCorrect;
  state.game.penaltyWrong = state.config.penaltyWrong;
  state.game.timeLeft = getConfiguredTotalSeconds();
  lastCountdownTickSecond = null;

  hideSummaryOverlay();
  hideAnswerAndJudgeButtons();
  switchView("game");
  renderRosco();
  renderHUD();
  enterLetter(firstPending);
  startGlobalCountdown(getConfiguredTotalMs());
}

function getFilteredQuestions(all) {
  const cycle = normalizeFilterValue(state.config.filters.cycle);
  const moduleValue = normalizeFilterValue(state.config.filters.module);
  const difficulty = normalizeFilterValue(state.config.filters.difficulty);

  return all.filter((item) => {
    const c = !cycle || normalizeFilterValue(item.ciclo) === cycle;
    const m = !moduleValue || normalizeFilterValue(item.modulo) === moduleValue;
    const d = !difficulty || normalizeFilterValue(item.dificultad) === difficulty;
    return c && m && d;
  });
}

function normalizeFilterValue(value) {
  const clean = String(value || "").trim();
  return clean ? clean.toLocaleLowerCase("es") : "";
}

function getActiveLetterState() {
  if (state.game.activeIndex < 0 || state.game.activeIndex >= state.game.letters.length) {
    return null;
  }
  return state.game.letters[state.game.activeIndex] || null;
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

function renderActiveQuestionPanel() {
  const active = getActiveLetterState();
  if (!active || active.status !== "pending" || !active.questionData) {
    refs.activeLetter.textContent = "-";
    refs.questionText.textContent = t("noActivePlayableLetter");
    refs.answerText.textContent = "";
    refs.answerBlock.classList.add("hidden");
    renderTeacherPanel();
    return;
  }

  refs.activeLetter.textContent = active.letra;
  refs.questionText.textContent = String(active.questionData.pregunta || "").trim();
  refs.answerText.textContent = active.questionData.respuesta;
  renderTeacherPanel();
}

function renderRosco() {
  renderRoscoCircle(refs.rosco, state.game.letters, state.game.activeIndex);
  renderTeacherPanel();
}

function renderHUD() {
  refs.timerDisplay.textContent = formatMMSS(state.game.timeLeft);
  refs.scoreDisplay.textContent = String(state.game.score);
  renderTeacherPanel();
}

function hideAnswerAndJudgeButtons() {
  refs.answerBlock.classList.add("hidden");
  refs.btnReadAnswer.classList.add("hidden");
  refs.btnCorrect.classList.add("hidden");
  refs.btnWrong.classList.add("hidden");
}

function handleReveal() {
  const active = getActiveLetterState();
  const allowed = state.game.running
    && !state.game.blockedByTime
    && active
    && active.status === "pending"
    && active.questionData;

  if (!allowed) {
    return;
  }

  state.game.answerRevealed = true;
  refs.answerBlock.classList.remove("hidden");
  refs.btnReadAnswer.classList.remove("hidden");
  refs.btnCorrect.classList.remove("hidden");
  refs.btnWrong.classList.remove("hidden");
  syncActionButtons();
  renderTeacherPanel();
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
  if (!state.game.running || state.game.blockedByTime || !state.game.answerRevealed) {
    return;
  }

  const active = getActiveLetterState();
  if (!active || active.status !== "pending") {
    return;
  }

  active.status = "correct";
  state.game.score += state.game.pointsPerCorrect;
  playCorrectSfx(state.config.audioEnabled);
  hideAnswerAndJudgeButtons();
  renderRosco();
  renderHUD();
  moveToNextPending();
}

function onMarkWrong() {
  if (!state.game.running || state.game.blockedByTime || !state.game.answerRevealed) {
    return;
  }

  const active = getActiveLetterState();
  if (!active || active.status !== "pending") {
    return;
  }

  active.status = "wrong";
  if (state.game.penaltyWrong > 0) {
    state.game.score = Math.max(0, state.game.score - state.game.penaltyWrong);
  }
  playWrongSfx(state.config.audioEnabled);
  hideAnswerAndJudgeButtons();
  renderRosco();
  renderHUD();
  moveToNextPending();
}

function moveToNextPending() {
  const next = findNextPendingIndex(state.game.activeIndex);
  if (next === -1) {
    endGame("ALL_DONE");
    return;
  }
  enterLetter(next);
}

function moveToPreviousPending() {
  const prev = findPreviousPendingIndex(state.game.activeIndex);
  if (prev === -1) {
    return;
  }
  enterLetter(prev);
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

function findPreviousPendingIndex(fromIndex) {
  if (!state.game.letters.length) {
    return -1;
  }

  for (let offset = 1; offset <= state.game.letters.length; offset += 1) {
    const idx = (fromIndex - offset + state.game.letters.length) % state.game.letters.length;
    if (state.game.letters[idx].status === "pending") {
      return idx;
    }
  }
  return -1;
}

function endGame(reason) {
  state.game.running = false;
  state.game.timerPaused = false;
  state.game.answerRevealed = false;
  stopTimer();
  stopSpeak();

  hideAnswerAndJudgeButtons();
  syncActionButtons();
  syncTimerButtons();
  renderRosco();
  renderHUD();
  refs.activeLetter.textContent = "-";
  refs.questionText.textContent = reason === "TIME_UP" ? t("summaryReasonTime") : t("summaryReasonDone");

  showSummaryOverlay(reason);
}

function syncActionButtons() {
  const active = getActiveLetterState();
  const canPlay = state.game.running
    && !state.game.blockedByTime
    && active
    && active.status === "pending";

  refs.btnReveal.disabled = !canPlay;
  refs.btnPass.disabled = !canPlay;
  refs.btnReadQuestion.disabled = !canPlay || !state.config.audioEnabled;
  refs.btnReadAnswer.disabled = !canPlay || !state.game.answerRevealed || !state.config.audioEnabled;
  refs.btnCorrect.disabled = !canPlay || !state.game.answerRevealed;
  refs.btnWrong.disabled = !canPlay || !state.game.answerRevealed;
}

function syncTimerButtons() {
  const activeGame = state.game.running && !state.game.blockedByTime;
  refs.btnTimerPause.disabled = !activeGame || !timerIsRunning() || timerIsPaused();
  refs.btnTimerResume.disabled = !activeGame || !timerIsRunning() || !timerIsPaused();
  refs.btnTimerReset.disabled = false;
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
  const seconds = Math.max(0, Math.ceil((Number(remainingMs) || 0) / 1000));
  state.game.timeLeft = seconds;

  if (
    state.game.running
    && !state.game.blockedByTime
    && state.config.audioEnabled
    && seconds > 0
    && seconds <= 10
    && seconds !== lastCountdownTickSecond
  ) {
    lastCountdownTickSecond = seconds;
    playCountdownTickSfx(true);
  } else if (seconds > 10 || seconds === 0) {
    lastCountdownTickSecond = null;
  }

  renderHUD();
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

function handleResetTimer() {
  const totalMs = getConfiguredTotalMs();
  hideSummaryOverlay();

  if (state.game.letters.length > 0) {
    state.game.blockedByTime = false;
    lastCountdownTickSecond = null;
    if (!state.game.running) {
      const firstPending = state.game.letters.findIndex((x) => x.status === "pending");
      if (firstPending >= 0) {
        state.game.running = true;
        enterLetter(firstPending);
      }
    }
    startGlobalCountdown(totalMs);
    return;
  }

  stopTimer();
  resetTimer(totalMs);
  state.game.timeLeft = Math.ceil(totalMs / 1000);
  renderHUD();
  syncTimerButtons();
}

function handleTimeElapsed() {
  state.game.timeLeft = 0;
  state.game.blockedByTime = true;
  playTimeUpSfx(state.config.audioEnabled);
  renderHUD();
  endGame("TIME_UP");
}

function handleNewGame() {
  if (!window.confirm(t("confirmNewGame"))) {
    return;
  }
  hideSummaryOverlay();
  startGame();
}

function handleExitToLanding() {
  if (!window.confirm(t("confirmExit"))) {
    return;
  }
  stopTimer();
  stopSpeak();
  state.game.running = false;
  state.game.blockedByTime = false;
  state.game.answerRevealed = false;
  lastCountdownTickSecond = null;
  hideSummaryOverlay();
  initializeGameLetters(Array.isArray(state.questionBank?.letras_incluidas) ? state.questionBank.letras_incluidas : []);
  renderRosco();
  renderHUD();
  syncActionButtons();
  syncTimerButtons();
  switchView("landing");
  refreshLandingStartState();
}

async function handleFullscreen() {
  const node = refs.gameContainer;
  if (!node) {
    return;
  }

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    if (node.requestFullscreen) {
      await node.requestFullscreen();
      return;
    }

    refs.configStatus.textContent = t("fullscreenUnavailable");
    addDiagnostic(t("fullscreenUnavailable"), "warn");
  } catch (error) {
    refs.configStatus.textContent = t("fullscreenError", { error: error.message });
    addDiagnostic(`Error en requestFullscreen: ${error.message}`, "error", error);
  }
}

function renderSummary(summary) {
  refs.summaryTitle.textContent = t("summaryTitle");
  refs.summaryReason.textContent = summary.reason === "TIME_UP" ? t("summaryReasonTime") : t("summaryReasonDone");
  refs.summaryPlayerName.textContent = summary.playerName || "-";
  refs.summaryScore.textContent = String(summary.puntuacion);
  refs.summaryPercent.textContent = `${summary.porcentaje}%`;
  refs.summaryCorrect.textContent = String(summary.correctas);
  refs.summaryWrong.textContent = String(summary.erroneas);
  refs.summaryPassed.textContent = String(summary.pasadas);
  refs.summaryTimeLeft.textContent = summary.tiempoRestante;
  refs.summaryTimeUsed.textContent = summary.tiempoConsumido;
}

function showSummaryOverlay(reason) {
  latestSummary = buildSummary(reason);
  persistScore(latestSummary);
  renderTopScores();
  renderSummary(latestSummary);
  refs.summaryOverlay.classList.remove("hidden");
}

function hideSummaryOverlay() {
  refs.summaryOverlay.classList.add("hidden");
}

function showTopScoresOverlay() {
  renderTopScores();
  refs.topScoresOverlay.classList.remove("hidden");
}

function hideTopScoresOverlay() {
  refs.topScoresOverlay.classList.add("hidden");
}

function buildSummary(reason) {
  const byLetter = state.game.letters.map((entry) => ({
    letra: entry.letra,
    pregunta: entry.questionData?.pregunta || "",
    respuesta: entry.questionData?.respuesta || "",
    estado: entry.status
  }));

  const playable = byLetter.filter((x) => x.estado !== "disabled");
  const correctas = playable.filter((x) => x.estado === "correct").length;
  const erroneas = playable.filter((x) => x.estado === "wrong").length;
  const pasadas = playable.filter((x) => x.estado === "pending").length;
  const porcentaje = playable.length > 0 ? Math.round((correctas / playable.length) * 100) : 0;
  const totalConfiguredSeconds = getConfiguredTotalSeconds();
  const remainingSeconds = Math.max(0, Number(state.game.timeLeft) || 0);
  const usedSeconds = Math.max(0, totalConfiguredSeconds - remainingSeconds);

  return {
    timestamp: new Date().toISOString(),
    reason,
    playerName: state.config.playerName || "",
    puntuacion: state.game.score,
    correctas,
    erroneas,
    pasadas,
    porcentaje,
    tiempoRestante: formatMMSS(remainingSeconds),
    tiempoConsumido: formatMMSS(usedSeconds),
    byLetter
  };
}

function exportResultsJson() {
  if (!latestSummary) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    configuracion: {
      playerName: state.config.playerName || "",
      tiempo: {
        valor: state.config.totalTime,
        unidad: state.config.timeUnit,
        totalSeconds: getConfiguredTotalSeconds()
      },
      filtros: {
        ciclo: state.config.filters.cycle,
        modulo: state.config.filters.module,
        dificultad: state.config.filters.difficulty
      },
      shuffle: !!state.config.shuffle,
      audioEnabled: !!state.config.audioEnabled,
      tts: state.config.tts,
      fuenteBanco: state.bankMeta
    },
    resultados: {
      puntuacion: latestSummary.puntuacion,
      correctas: latestSummary.correctas,
      erroneas: latestSummary.erroneas,
      pasadas: latestSummary.pasadas,
      porcentaje: latestSummary.porcentaje,
      tiempoRestante: latestSummary.tiempoRestante,
      tiempoConsumido: latestSummary.tiempoConsumido,
      porLetra: latestSummary.byLetter
    }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `roscointegra_resultados_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
  state.config.playerName = String(refs.playerNameInput.value || "").trim();
  state.config.shuffle = refs.cfgShuffle.checked;
  state.config.totalTime = Math.max(1, Number.parseInt(refs.cfgTime.value, 10) || 1);
  state.config.timeUnit = refs.cfgTimeUnit.value === "minutes" ? "minutes" : "seconds";
  state.config.pointsCorrect = Number(refs.cfgPoints.value) || 0;
  state.config.penaltyWrong = Math.max(0, Number(refs.cfgPenalty.value) || 0);
  state.config.audioEnabled = refs.cfgAudioEnabled.checked;

  state.config.filters.cycle = refs.filterCycle.value || "";
  state.config.filters.module = refs.filterModule.value || "";
  state.config.filters.difficulty = refs.filterDifficulty.value || "";

  state.config.tts.voice = refs.ttsVoice.value || "";
  state.config.tts.rate = Number(refs.ttsRate.value) || 1;
  state.config.tts.pitch = Number(refs.ttsPitch.value) || 1;
  state.config.ui.teacherMode = !!refs.cfgTeacherMode.checked;

  saveJSON(CONFIG_KEY, state.config);

  if (!state.config.audioEnabled) {
    stopSpeak();
  }

  syncAudioUi();
  syncTeacherModeUi();
  updateTtsStatus();
  refreshLandingStartState();
  renderCurrentPlayer();

  if (!state.game.running && !timerIsRunning()) {
    state.game.timeLeft = getConfiguredTotalSeconds();
    renderHUD();
  }
}

function hydrateConfig() {
  const saved = loadJSON(CONFIG_KEY, null);
  state.config = {
    ...DEFAULT_CONFIG,
    ...(saved || {}),
    filters: {
      ...DEFAULT_CONFIG.filters,
      ...(saved?.filters || {})
    },
    ui: {
      ...DEFAULT_CONFIG.ui,
      ...(saved?.ui || {})
    },
    tts: {
      ...DEFAULT_CONFIG.tts,
      ...(saved?.tts || {})
    }
  };

  refs.cfgShuffle.checked = !!state.config.shuffle;
  refs.playerNameInput.value = state.config.playerName || "";
  refs.cfgTime.value = String(state.config.totalTime);
  refs.cfgTimeUnit.value = state.config.timeUnit === "minutes" ? "minutes" : "seconds";
  refs.cfgPoints.value = String(state.config.pointsCorrect);
  refs.cfgPenalty.value = String(state.config.penaltyWrong);
  refs.cfgAudioEnabled.checked = !!state.config.audioEnabled;

  refs.ttsVoice.value = state.config.tts.voice || "";
  refs.ttsRate.value = String(state.config.tts.rate || 1);
  refs.ttsPitch.value = String(state.config.tts.pitch || 1);

  refs.cfgTeacherMode.checked = !!state.config.ui.teacherMode;
  state.game.timeLeft = getConfiguredTotalSeconds();
}

function handleResetConfig() {
  if (!window.confirm(t("confirmResetConfig"))) {
    return;
  }

  removeItem(CONFIG_KEY);
  state.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  hydrateConfig();
  persistConfigFromForm();
  refs.configStatus.textContent = t("configReset");
}

function renderVoices() {
  const voices = listVoices();
  refs.ttsVoice.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = t("voicePreferred");
  refs.ttsVoice.appendChild(defaultOption);

  voices.forEach((voice) => {
    const opt = document.createElement("option");
    opt.value = voice.name;
    opt.textContent = `${voice.name} (${voice.lang})`;
    refs.ttsVoice.appendChild(opt);
  });

  refs.ttsVoice.value = state.config.tts.voice || "";
}

function updateTtsStatus() {
  if (!refs.ttsStatus) {
    return;
  }

  if (!state.config.audioEnabled) {
    refs.ttsStatus.textContent = t("ttsDisabled");
    return;
  }

  const status = getTtsStatus();
  if (status.mode === "web") {
    refs.ttsStatus.textContent = status.message || t("ttsBrowserActive");
    return;
  }

  if (status.mode === "audio") {
    refs.ttsStatus.textContent = t("ttsLocalFallback");
    return;
  }

  refs.ttsStatus.textContent = t("ttsUnavailable");
}

function syncAudioUi() {
  const disabled = !state.config.audioEnabled;
  refs.btnReadQuestion.disabled = disabled || refs.btnReadQuestion.disabled;
  refs.btnReadAnswer.disabled = disabled || refs.btnReadAnswer.disabled;
  refs.btnTtsStop.disabled = disabled;
  refs.btnTtsPause.disabled = disabled;
  refs.btnTtsResume.disabled = disabled;
}

function speakCurrentQuestion() {
  if (!state.config.audioEnabled) {
    return;
  }

  const active = getActiveLetterState();
  if (!active?.questionData) {
    return;
  }

  const typeKey = String(active.questionData.tipoKey || "").trim() || normalizeQuestionTypeForSpeech(active.questionData.tipo);
  const questionText = String(active.questionData.pregunta || "").trim();
  const alreadyPrefixed = /^(con|contiene|cont[ée]n|contains|with)\b/i.test(questionText);
  const prefix = typeKey === "contains"
    ? t("questionPrefixContains", { letter: active.letra })
    : t("questionPrefixStarts", { letter: active.letra });

  const text = alreadyPrefixed
    ? questionText
    : `${prefix}. ${questionText}`;

  speak(text, {
    voice: refs.ttsVoice.value,
    rate: Number(refs.ttsRate.value) || 1,
    pitch: Number(refs.ttsPitch.value) || 1,
    letter: active.letra,
    questionId: active.questionData.id || "",
    questionIndex: active.questionData.audioIndex || active.questionData.idx || "",
    audioCandidates: buildQuestionAudioCandidates(active)
  }).catch((error) => {
    addDiagnostic(t("audioQuestionError", { error: error.message }), "warn", error);
  });

  updateTtsStatus();
}

function speakCurrentAnswer() {
  if (!state.config.audioEnabled || !state.game.answerRevealed) {
    return;
  }

  const active = getActiveLetterState();
  if (!active?.questionData) {
    return;
  }

  speak(active.questionData.respuesta, {
    voice: refs.ttsVoice.value,
    rate: Number(refs.ttsRate.value) || 1,
    pitch: Number(refs.ttsPitch.value) || 1,
    letter: active.letra,
    questionId: active.questionData.id || "",
    questionIndex: active.questionData.audioIndex || active.questionData.idx || "",
    audioCandidates: buildAnswerAudioCandidates(active)
  }).catch((error) => {
    addDiagnostic(t("audioAnswerError", { error: error.message }), "warn", error);
  });

  updateTtsStatus();
}

function buildQuestionAudioCandidates(active) {
  const q = active.questionData || {};
  const candidates = [];
  if (q.audioQuestion) candidates.push(q.audioQuestion);
  if (q.audio) candidates.push(q.audio);
  if (q.audioFile) candidates.push(q.audioFile);
  if (active.letra && q.idx) candidates.push(`${active.letra}_${q.idx}.mp3`);
  if (active.letra && q.audioIndex) candidates.push(`${active.letra}_${q.audioIndex}.mp3`);
  return candidates;
}

function buildAnswerAudioCandidates(active) {
  const q = active.questionData || {};
  const candidates = [];
  if (q.audioAnswer) candidates.push(q.audioAnswer);
  if (q.answerAudio) candidates.push(q.answerAudio);
  if (active.letra && q.idx) candidates.push(`${active.letra}_${q.idx}_r.mp3`);
  return candidates;
}

function normalizeQuestionTypeForSpeech(rawType) {
  const value = String(rawType || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (value.includes("cont")) {
    return "contains";
  }
  return "starts";
}

function renderCurrentPlayer() {
  const fallback = t("anonymousPlayer");
  const playerName = String(state.config.playerName || "").trim();
  refs.currentPlayerName.textContent = playerName || fallback;
}

function getSavedScores() {
  const rows = loadJSON(SCORES_KEY, []);
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => ({
      playerName: String(row?.playerName || "").trim(),
      score: Number(row?.score) || 0,
      timestamp: String(row?.timestamp || "")
    }))
    .filter((row) => Number.isFinite(row.score) && row.score >= 0);
}

function persistScore(summary) {
  const all = getSavedScores();
  all.push({
    playerName: summary.playerName || "",
    score: Number(summary.puntuacion) || 0,
    timestamp: summary.timestamp || new Date().toISOString()
  });

  all.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return String(a.timestamp).localeCompare(String(b.timestamp));
  });

  saveJSON(SCORES_KEY, all.slice(0, 10));
}

function renderTopScores() {
  const rows = getSavedScores()
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return String(a.timestamp).localeCompare(String(b.timestamp));
    })
    .slice(0, 10);

  refs.topScoresList.innerHTML = "";

  rows.forEach((entry, index) => {
    const item = document.createElement("li");
    item.textContent = t("top10ScoreItem", { rank: index + 1, score: entry.score });
    refs.topScoresList.appendChild(item);
  });

  refs.topScoresEmpty.classList.toggle("hidden", rows.length > 0);
}

function handleClearTopScores() {
  if (!window.confirm(t("confirmClearTop10"))) {
    return;
  }
  removeItem(SCORES_KEY);
  renderTopScores();
  hideTopScoresOverlay();
}

function syncTeacherModeUi() {
  const enabled = !!state.config.ui.teacherMode;
  refs.teacherPanel.classList.toggle("hidden", !enabled);
  renderTeacherPanel();
}

function renderTeacherPanel() {
  if (!state.config.ui.teacherMode) {
    refs.teacherStateText.textContent = "";
    return;
  }

  refs.teacherStateText.textContent = JSON.stringify(getTeacherSnapshot(), null, 2);
}

function getTeacherSnapshot() {
  const counters = state.game.letters.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, { pending: 0, correct: 0, wrong: 0, disabled: 0 });

  return {
    view: state.ui.view,
    running: state.game.running,
    blockedByTime: state.game.blockedByTime,
    timerPaused: state.game.timerPaused,
    activeIndex: state.game.activeIndex,
    activeLetter: state.game.activeLetter,
    answerRevealed: state.game.answerRevealed,
    score: state.game.score,
    timeLeft: state.game.timeLeft,
    letters: counters,
    bankMeta: state.bankMeta,
    config: {
      shuffle: state.config.shuffle,
      filters: state.config.filters,
      audioEnabled: state.config.audioEnabled,
      tts: state.config.tts
    }
  };
}
function handleShortcuts(event) {
  if (event.key === "Escape" && !refs.topScoresOverlay.classList.contains("hidden")) {
    hideTopScoresOverlay();
    return;
  }

  if (isTypingTarget(event.target)) {
    return;
  }

  const key = event.key;

  if (key === " ") {
    event.preventDefault();
    if (state.ui.view !== "game") {
      return;
    }
    if (!state.game.running) {
      startGame();
      return;
    }
    if (timerIsPaused()) {
      handleResumeTimer();
    } else {
      handlePauseTimer();
    }
    return;
  }

  if (state.ui.view !== "game" || !state.game.running || state.game.blockedByTime) {
    return;
  }

  switch (key.toLowerCase()) {
    case "r":
      if (!refs.btnReveal.disabled) refs.btnReveal.click();
      break;
    case "p":
      if (!refs.btnPass.disabled) refs.btnPass.click();
      break;
    case "a":
    case "c":
      if (state.game.answerRevealed && !refs.btnCorrect.disabled) refs.btnCorrect.click();
      break;
    case "f":
    case "e":
      if (state.game.answerRevealed && !refs.btnWrong.disabled) refs.btnWrong.click();
      break;
    default:
      if (key === "ArrowRight") {
        event.preventDefault();
        moveToNextPending();
      }
      if (key === "ArrowLeft") {
        event.preventDefault();
        moveToPreviousPending();
      }
      break;
  }
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

init().catch((error) => {
  console.error("[RoscoIntegra] Error fatal de inicializacion", error);
  refs.loadStatus.textContent = t("initError", { error: error.message });
  addDiagnostic(`Error fatal de inicializacion: ${error.message}`, "error", error);
});
