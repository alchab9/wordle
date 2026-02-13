// Scoring and picking best next guess

import { scoreGuess } from './feedback.js';

export function scoreWordEntropy(guess: string, candidates: string[]): number {
  const n = candidates.length;
  if (n <= 1) return 0;

  const counts: Record<string, number> = Object.create(null);
  for (const answer of candidates) {
    const feedback = scoreGuess(answer, guess);
    counts[feedback] = (counts[feedback] || 0) + 1;
  }

  let entropy = 0;
  for (const feedback of Object.keys(counts)) {
    const p = counts[feedback] / n;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function scoreWordExpectedRemaining(
  guess: string,
  candidates: string[]
): { expectedRemaining: number; maxPartitionSize: number } {
  const n = candidates.length;
  if (n <= 1) return { expectedRemaining: n, maxPartitionSize: n };

  const counts: Record<string, number> = Object.create(null);
  for (const answer of candidates) {
    const feedback = scoreGuess(answer, guess);
    counts[feedback] = (counts[feedback] || 0) + 1;
  }

  let sumSquares = 0;
  let maxCount = 0;
  for (const feedback of Object.keys(counts)) {
    const c = counts[feedback];
    sumSquares += c * c;
    if (c > maxCount) maxCount = c;
  }
  return { expectedRemaining: sumSquares / n, maxPartitionSize: maxCount };
}

export function pickBestGuess(candidates: string[] | null): string | null {
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  let best: string | null = null;
  let bestExpected = Infinity;
  let bestMaxPartition = Infinity;
  let bestDistinct = -1;

  for (const word of candidates) {
    const { expectedRemaining, maxPartitionSize } = scoreWordExpectedRemaining(word, candidates);
    const distinct = new Set(word.toLowerCase()).size;
    const better =
      expectedRemaining < bestExpected ||
      (expectedRemaining === bestExpected && maxPartitionSize < bestMaxPartition) ||
      (expectedRemaining === bestExpected &&
        maxPartitionSize === bestMaxPartition &&
        distinct > bestDistinct);
    if (better) {
      best = word;
      bestExpected = expectedRemaining;
      bestMaxPartition = maxPartitionSize;
      bestDistinct = distinct;
    }
  }

  return best;
}
