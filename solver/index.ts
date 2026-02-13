// Re-export all solver APIs

export {
  isValidResult,
  getGuessFeedback,
  scoreGuess,
  matchesAllFeedback,
} from './feedback.js';

export {
  createConstraintState,
  applyFeedback,
  isValidCandidate,
} from './constraints.js';

export {
  scoreWordEntropy,
  scoreWordExpectedRemaining,
  pickBestGuess,
} from './guesser.js';
