import { createConstraintState } from '../solver/index.js';
import type { GameState } from '../types.js';

export function initState(words: string[]): GameState {
  return {
    currentOptions: [...words],
    constraints: createConstraintState(),
    history: [],
    round: 0,
    nextGuess: null,
    gameOver: false,
    win: false,
    message: null,
    winningWord: null,
    currentResult: [null, null, null, null, null],
    nextGuessScore: null,
    overrideMode: false,
    overrideWord: null,
    prefillNextWord: null,
    addWordMode: false,
    replayGuesses: null,
    earlyWinnerWord: null,
    octordleWins: [],
  };
}

export function startOctordleNextRound(state: GameState, words: string[]): void {
  const prevReplay = state.replayGuesses || [];
  const fullList: string[] = [];
  for (let row = 0; row < prevReplay.length; row++) {
    fullList.push(row < state.history.length ? state.history[row].guess : prevReplay[row]);
  }
  for (let row = prevReplay.length; row < state.history.length; row++) {
    fullList.push(state.history[row].guess);
  }
  if (state.winningWord) fullList.push(state.winningWord);
  state.replayGuesses = fullList;
  state.history = [];
  state.round = 0;
  state.constraints = createConstraintState();
  state.currentOptions = [...words];
  state.gameOver = false;
  state.win = false;
  state.message = null;
  state.winningWord = null;
  state.nextGuess = null;
  state.nextGuessScore = null;
  state.currentResult = [null, null, null, null, null];
  state.overrideWord = null;
  state.prefillNextWord = null;
  state.earlyWinnerWord = null;
}
