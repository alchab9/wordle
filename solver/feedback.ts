// Result validation and Wordle feedback (g/y/x)

import type { FeedbackItem, HistoryEntry } from '../types.js';

const RESULT_MAP: Record<string, 'gray' | 'green' | 'yellow'> = {
  x: 'gray',
  g: 'green',
  y: 'yellow',
};

export function isValidResult(result: string): boolean {
  const trimmed = result.trim().toLowerCase();
  if (trimmed.length === 0) return false;
  return /^[xgy]+$/.test(trimmed);
}

export function getGuessFeedback(guess: string, result: string): FeedbackItem[] {
  const guessLower = guess.trim().toLowerCase();
  const resultLower = result.trim().toLowerCase();
  return [...guessLower].slice(0, resultLower.length).map((letter, i) => ({
    index: i,
    letter,
    result: (RESULT_MAP[resultLower[i]] ?? 'gray') as 'gray' | 'green' | 'yellow',
  }));
}

/**
 * Simulates Wordle feedback for a given answer and guess.
 */
export function scoreGuess(answer: string, guess: string): string {
  const a = answer.trim().toLowerCase();
  const g = guess.trim().toLowerCase();
  const len = Math.min(a.length, g.length, 5);
  const result = new Array<string>(len).fill('x');
  const used = new Set<number>();

  for (let i = 0; i < len; i++) {
    if (g[i] === a[i]) {
      result[i] = 'g';
      used.add(i);
    }
  }

  for (let i = 0; i < len; i++) {
    if (result[i] === 'g') continue;
    const letter = g[i];
    for (let j = 0; j < len; j++) {
      if (!used.has(j) && a[j] === letter) {
        result[i] = 'y';
        used.add(j);
        break;
      }
    }
  }

  return result.join('');
}

/**
 * Returns true iff, when treating `candidate` as the secret word,
 * the feedback for each past guess matches the observed result.
 */
export function matchesAllFeedback(candidate: string, history: HistoryEntry[]): boolean {
  const c = candidate.trim().toLowerCase();
  for (const { guess, result } of history) {
    const simulated = scoreGuess(c, guess);
    const expected = result.trim().toLowerCase();
    if (simulated !== expected) return false;
  }
  return true;
}
