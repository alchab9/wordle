// Shared types for solver and app

export type FeedbackColor = 'green' | 'yellow' | 'gray';

export interface FeedbackItem {
  index: number;
  letter: string;
  result: FeedbackColor;
}

export interface HistoryEntry {
  guess: string;
  result: string;
}

export interface ConstraintState {
  positionKnown: (string | null)[];
  mustContain: Record<string, Set<number>>;
  minCounts: Record<string, number>;
  maxCounts: Record<string, number>;
}

export interface OctordleWin {
  word: string;
  guessCount: number;
}

export interface GameState {
  currentOptions: string[];
  constraints: ConstraintState;
  history: HistoryEntry[];
  round: number;
  nextGuess: string | null;
  gameOver: boolean;
  win: boolean;
  message: string | null;
  winningWord: string | null;
  currentResult: (string | null)[];
  nextGuessScore: { expectedRemaining: number; maxPartitionSize: number } | null;
  overrideMode: boolean;
  overrideWord: string | null;
  prefillNextWord: string | null;
  addWordMode: boolean;
  replayGuesses: string[] | null;
  earlyWinnerWord: string | null;
  octordleWins: OctordleWin[];
  noOptionsLeft?: boolean;
}
