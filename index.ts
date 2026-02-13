// Wordle Puzzle Solver — CLI entry point

import readline from 'readline';
import type { HistoryEntry } from './types.js';
import {
  isValidResult,
  getGuessFeedback,
  createConstraintState,
  applyFeedback,
  isValidCandidate,
  matchesAllFeedback,
  pickBestGuess,
  scoreWordExpectedRemaining,
} from './solver/index.js';

// When running from dist/, words.json is copied there by the build script
import words from './words.json' with { type: 'json' };

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (answer: string) => resolve(answer)));
}

const MAX_GUESSES = 6;

async function run(): Promise<void> {
  const allWords = words as string[];
  let currentOptions = [...allWords];
  const constraints = createConstraintState();
  const history: HistoryEntry[] = [];
  let guess: string | null = null;
  let nextGuess: string | null = null;

  for (let round = 0; round < MAX_GUESSES; round++) {
    guess = round === 0 ? 'arise' : (nextGuess ?? pickBestGuess(currentOptions));
    if (!guess) break;
    console.log('\n--- Round', round + 1, '---');
    console.log('Guess:', guess);

    let result: string;
    while (true) {
      const input = await ask('Result: ');
      if (isValidResult(input)) {
        result = input.trim().toLowerCase();
        break;
      }
      console.log('Result must contain only x, g, or y (e.g. xgygx)');
    }

    if (result === 'ggggg') {
      console.log('\nYou got it!');
      break;
    }

    history.push({ guess, result });
    const feedback = getGuessFeedback(guess, result);
    applyFeedback(constraints, feedback);
    currentOptions = currentOptions.filter(
      (word) =>
        isValidCandidate(word, constraints) &&
        matchesAllFeedback(word, history)
    );

    console.log('Remaining options:', currentOptions.length);

    const guessesLeft = MAX_GUESSES - (round + 1);
    if (guessesLeft > 0 && currentOptions.length > guessesLeft) {
      console.log('⚠️  Warning: ' + currentOptions.length + ' options left but only ' + guessesLeft + ' guess(es) remaining — might not solve in time.');
    }
    if (guessesLeft === 0 && currentOptions.length > 1) {
      console.log('\nOut of guesses — didn\'t solve it. Possible answers: ' + currentOptions.slice(0, 10).join(', ') + (currentOptions.length > 10 ? ' ...' : '') + ' (' + currentOptions.length + ' total).');
    }

    if (currentOptions.length === 0) {
      console.log('No options left.');
      break;
    }

    if (currentOptions.length === 1) {
      console.log('\nYou got it! The answer is:', currentOptions[0]);
      break;
    }

    nextGuess = pickBestGuess(currentOptions);
    if (nextGuess) {
      const { expectedRemaining, maxPartitionSize } = scoreWordExpectedRemaining(nextGuess, currentOptions);
      console.log('Next guess:', nextGuess, '(expected remaining:', expectedRemaining.toFixed(1) + ', max partition:', maxPartitionSize + ', lower is better)');
    }
  }

  rl.close();
}

run();
