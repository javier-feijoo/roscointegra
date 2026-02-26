export const state = {
  ui: {
    view: "landing"
  },
  game: {
    letters: [],
    selectedByLetter: {},
    poolByLetter: {},
    activeIndex: -1,
    activeLetter: null,
    answerRevealed: false,
    running: false,
    blockedByTime: false,
    timerPaused: false,
    score: 0,
    timeLeft: 0,
    pointsPerCorrect: 10,
    penaltyWrong: 0
  },
  config: {
    playerName: "",
    shuffle: true,
    totalTime: 180,
    timeUnit: "seconds",
    pointsCorrect: 10,
    penaltyWrong: 0,
    audioEnabled: true,
    filters: {
      cycle: "",
      module: "",
      difficulty: ""
    },
    ui: {
      teacherMode: false
    },
    tts: {
      voice: "",
      rate: 1,
      pitch: 1
    }
  },
  questionBank: null,
  bankMeta: {
    source: "-",
    file: "-",
    totalQuestions: 0
  }
};

export function initializeGameLetters(letterOrder = []) {
  const order = Array.isArray(letterOrder) ? letterOrder : [];

  state.game.letters = order.map((letra) => ({
    letra,
    status: "disabled",
    questionData: null
  }));
  state.game.selectedByLetter = {};
  state.game.poolByLetter = Object.fromEntries(order.map((letra) => [letra, []]));
  state.game.activeIndex = -1;
  state.game.activeLetter = null;
  state.game.answerRevealed = false;
  state.game.running = false;
  state.game.blockedByTime = false;
  state.game.timerPaused = false;
}
