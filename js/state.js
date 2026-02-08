export const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"];

export const state = {
  game: {
    letters: [],
    activeIndex: -1,
    selectedByLetter: {},
    poolByLetter: {},
    activeLetter: null,
    score: 0,
    timeLeft: 0,
    running: false,
    pointsPerCorrect: 10,
    answerRevealed: false,
    blockedByTime: false,
    timerPaused: false
  },
  config: {
    shuffle: true,
    totalTime: 180,
    timeUnit: "seconds",
    pointsCorrect: 10,
    penaltyWrong: 0,
    tts: {
      auto: true,
      voice: "",
      rate: 1,
      pitch: 1
    }
  },
  questionBank: null
};

export function initializeGameLetters() {
  state.game.letters = LETTERS.map((letra) => ({
    letra,
    status: "disabled",
    questionData: null
  }));
  state.game.activeIndex = -1;
  state.game.selectedByLetter = {};
  state.game.poolByLetter = Object.fromEntries(LETTERS.map((letra) => [letra, []]));
  state.game.activeLetter = null;
  state.game.answerRevealed = false;
  state.game.blockedByTime = false;
  state.game.timerPaused = false;
}
