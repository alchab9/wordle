// Constraint state and candidate filtering

import type { ConstraintState, FeedbackItem } from '../types.js';

export function createConstraintState(): ConstraintState {
  return {
    positionKnown: [null, null, null, null, null],
    mustContain: {},
    minCounts: {},
    maxCounts: {},
  };
}

export function applyFeedback(state: ConstraintState, feedback: FeedbackItem[]): ConstraintState {
  const letterStats: Record<string, { green: number; yellow: number; gray: number }> = {};

  for (const { index: i, letter, result } of feedback) {
    if (!letterStats[letter]) {
      letterStats[letter] = { green: 0, yellow: 0, gray: 0 };
    }
    letterStats[letter][result]++;

    if (result === 'green') {
      state.positionKnown[i] = letter;
    } else if (result === 'yellow') {
      if (!state.mustContain[letter]) state.mustContain[letter] = new Set();
      state.mustContain[letter].add(i);
    }
  }

  for (const { index: i, letter, result } of feedback) {
    if (result === 'gray') {
      const { green, yellow } = letterStats[letter];
      if (green + yellow > 0) {
        if (!state.mustContain[letter]) state.mustContain[letter] = new Set();
        state.mustContain[letter].add(i);
      }
    }
  }

  for (const letter in letterStats) {
    const { green, yellow, gray } = letterStats[letter];
    const min = green + yellow;

    state.minCounts[letter] = Math.max(state.minCounts[letter] ?? 0, min);

    if (gray > 0) {
      const prevMax = state.maxCounts[letter];
      const newMax = min;
      state.maxCounts[letter] =
        prevMax === undefined ? newMax : Math.min(prevMax, newMax);
    }

    if (state.maxCounts[letter] !== undefined) {
      if (state.maxCounts[letter] < state.minCounts[letter]) {
        delete state.maxCounts[letter];
      }
    }
  }

  return state;
}

function countLetters(word: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of word) {
    counts[c] = (counts[c] || 0) + 1;
  }
  return counts;
}

export function isValidCandidate(word: string, constraints: ConstraintState): boolean {
  const { positionKnown, mustContain } = constraints;
  const w = word.toLowerCase();
  const counts = countLetters(w);

  for (let i = 0; i < 5; i++) {
    if (positionKnown[i] !== null && w[i] !== positionKnown[i]) {
      return false;
    }
  }

  for (const letter in mustContain) {
    if (!w.includes(letter)) return false;
    for (const badIndex of mustContain[letter]) {
      if (w[badIndex] === letter) return false;
    }
  }

  for (const letter in constraints.minCounts) {
    if ((counts[letter] || 0) < constraints.minCounts[letter]) return false;
  }

  for (const letter in constraints.maxCounts) {
    if ((counts[letter] || 0) > constraints.maxCounts[letter]) return false;
  }

  return true;
}
