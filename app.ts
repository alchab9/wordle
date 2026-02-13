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
import { WORDLE_GUESSES, OCTORDLE_GUESSES } from './app/constants.js';
import { initState, startOctordleNextRound } from './app/state.js';
import { resultToClass, fireConfetti } from './app/utils.js';
import type { GameState } from './types.js';

let words: string[] | null = null;
let state: GameState | null = null;
let octordleMode = false;

const CUSTOM_WORDS_KEY = 'wordle-custom-words';

function getCustomWords(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_WORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomWord(word: string): void {
  const custom = getCustomWords();
  if (!custom.includes(word)) {
    custom.push(word);
    localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(custom));
  }
}

function getMaxGuesses(): number {
  return octordleMode ? OCTORDLE_GUESSES : WORDLE_GUESSES;
}

function showAddActualWordPopup(
  root: HTMLElement,
  onOpen: () => void,
  onUndoWin: (word: string) => void,
  renderFn: () => void
): void {
  const overlay = document.createElement('div');
  overlay.id = 'add-actual-word-overlay';
  overlay.className = 'octordle-results-overlay';
  overlay.innerHTML = `
    <div class="octordle-results-popup add-actual-word-popup">
      <button type="button" class="results-popup-close" id="add-actual-word-close" aria-label="Close">×</button>
      <h2 class="octordle-results-title">That wasn't the word</h2>
      <p style="margin:0 0 1rem; color:var(--muted, #888);">Enter the actual word to add to the list:</p>
      <input type="text" id="add-actual-word-input" placeholder="5-letter word" maxlength="5" autocomplete="off" />
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button type="button" class="btn" id="add-actual-word-submit">Add and continue</button>
        <button type="button" class="btn btn-secondary" id="add-actual-word-cancel">Cancel</button>
      </div>
    </div>
  `;
  root.appendChild(overlay);
  onOpen();

  const onEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
      renderFn();
    }
  };
  document.addEventListener('keydown', onEscape);

  const cleanup = () => {
    overlay.remove();
    document.removeEventListener('keydown', onEscape);
  };

  const input = overlay.querySelector('#add-actual-word-input') as HTMLInputElement;
  input.focus();
  input.oninput = () => {
    input.value = input.value.replace(/[^a-z]/gi, '').toLowerCase().slice(0, 5);
  };
  (overlay.querySelector('#add-actual-word-close') as HTMLButtonElement).onclick = () => {
    cleanup();
    renderFn();
  };
  (overlay.querySelector('#add-actual-word-submit') as HTMLButtonElement).onclick = () => {
    const word = (input.value || '').trim().toLowerCase();
    if (word.length !== 5) {
      alert('Enter a 5-letter word');
      return;
    }
    saveCustomWord(word);
    if (!words!.includes(word)) words!.push(word);
    onUndoWin(word);
    cleanup();
    renderFn();
  };
  (overlay.querySelector('#add-actual-word-cancel') as HTMLButtonElement).onclick = () => {
    cleanup();
    renderFn();
  };
}

function handleKeydown(e: KeyboardEvent): void {
  if (!state || state.gameOver) return;
  if (e.key === 'Enter') {
    const btn = document.getElementById('submit') as HTMLButtonElement | null;
    if (btn && !btn.disabled) {
      e.preventDefault();
      btn.click();
    }
    return;
  }
  if (e.key !== 'Backspace' && e.key !== 'Delete') return;
  let lastIdx = -1;
  for (let i = 4; i >= 0; i--) {
    if (state.currentResult[i] !== null) {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx < 0) return;
  state.currentResult[lastIdx] = null;
  e.preventDefault();
  render();
}

function render(): void {
  const root = document.getElementById('root');
  if (!root) return;
  document.body.classList.toggle('octordle-mode', octordleMode);
  if (!words) {
    root.innerHTML = '<p class="loading">Loading word list…</p>';
    return;
  }
  if (!state) state = initState(words);

  const {
    currentOptions,
    history,
    round,
    nextGuess,
    gameOver,
    win,
    message,
    winningWord,
    currentResult,
    overrideMode,
    overrideWord,
    addWordMode,
    replayGuesses,
    earlyWinnerWord,
    octordleWins = [],
  } = state;

  if (gameOver) {
    if (win && winningWord) {
      // Build win grid (kept as background when showing popup)
      const rowsHtml = [];
      if (replayGuesses) {
        for (let row = 0; row < replayGuesses.length; row++) {
          if (row < history.length) {
            const { guess, result } = history[row];
            const letters = guess.toUpperCase();
            const cellsHtml = [...result].map((r, col) => {
              const cls = ['cell', 'filled', resultToClass(r)].filter(Boolean).join(' ');
              return `<div class="${cls}">${letters[col]}</div>`;
            });
            rowsHtml.push(`<div class="row">${cellsHtml.join('')}</div>`);
          } else {
            const letters = replayGuesses[row].toUpperCase();
            const cellsHtml = [...letters].map((l) => `<div class="cell filled replay-pending">${l}</div>`).join('');
            rowsHtml.push(`<div class="row">${cellsHtml}</div>`);
          }
        }
        for (let row = replayGuesses.length; row < history.length; row++) {
          const { guess, result } = history[row];
          const letters = guess.toUpperCase();
          const cellsHtml = [...result].map((r, col) => {
            const cls = ['cell', 'filled', resultToClass(r)].filter(Boolean).join(' ');
            return `<div class="${cls}">${letters[col]}</div>`;
          });
          rowsHtml.push(`<div class="row">${cellsHtml.join('')}</div>`);
        }
      } else {
        history.forEach(({ guess, result }) => {
          const letters = guess.toUpperCase();
          const cellsHtml = [...result].map((r, col) => {
            const cls = ['cell', 'filled', resultToClass(r)].filter(Boolean).join(' ');
            return `<div class="${cls}">${letters[col]}</div>`;
          });
          rowsHtml.push(`<div class="row">${cellsHtml.join('')}</div>`);
        });
      }
      const finalWord = winningWord.toUpperCase();
      const finalRow = `<div class="row">${[...finalWord].map((l) => `<div class="cell filled green">${l}</div>`).join('')}</div>`;
      rowsHtml.push(finalRow);
      while (rowsHtml.length < getMaxGuesses()) {
        rowsHtml.push('<div class="row"><div class="cell empty"></div><div class="cell empty"></div><div class="cell empty"></div><div class="cell empty"></div><div class="cell empty"></div></div>');
      }
      const winScore = scoreWordExpectedRemaining(winningWord, [winningWord]);
      const winTableHtml = `
        <div class="options-list">
          <div class="options-list-title">Remaining options (1)</div>
          <div class="options-list-scroll">
            <table class="options-table">
              <thead><tr><th class="option-word-h">Word</th><th class="option-score-h">Score</th><th class="option-max-h">Minimax</th></tr></thead>
              <tbody>
                <tr><td class="option-word">${winningWord}</td><td class="option-score determining">${winScore.expectedRemaining.toFixed(1)}</td><td class="option-max">${winScore.maxPartitionSize}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      const gridHtml = `<div class="grid" id="win-grid">${rowsHtml.join('')}</div>`;

      // Octordle: all 8 words won — popup on top of grid
      if (octordleMode && octordleWins.length === 8) {
        const wins = octordleWins;
        const guessBadge = (g: number) =>
          g === OCTORDLE_GUESSES
            ? '<span class="octordle-result-clock" title="Last guess">🕐</span>'
            : `<span class="octordle-result-guesses">${g}</span>`;
        const rowHtml = (arr: { word: string; guessCount: number }[]) =>
          arr
            .map(
              ({ word, guessCount }: { word: string; guessCount: number }) =>
                `<div class="octordle-result-row"><span class="octordle-result-word">${word.toUpperCase()}</span>${guessBadge(guessCount)}</div>`
            )
            .join('');
        const leftCol = wins.slice(0, 4);
        const rightCol = wins.slice(4, 8);
        const closePopup = () => {
          document.removeEventListener('keydown', onEscape);
          root.querySelector('.octordle-results-overlay')?.remove();
          root.insertAdjacentHTML('beforeend', '<button class="btn" type="button" style="margin-top:1rem" id="restart">Play again</button>');
          document.getElementById('restart').onclick = () => {
            document.getElementById('confetti-container')?.remove();
            state = initState(words);
            render();
          };
        };
        const onEscape = (e: KeyboardEvent) => {
          if (e.key === 'Escape') closePopup();
        };
        document.addEventListener('keydown', onEscape);
        const winsListHtmlFinal = wins.map(
          (w, i) =>
            `<div class="octordle-win-item"><span class="octordle-win-round">Round ${i + 1}</span> <span class="octordle-win-word">${w.word.toUpperCase()}</span> <span class="octordle-result-guesses">${w.guessCount}</span></div>`
        ).join('');
        const popupHtml = `
          <div class="octordle-results-overlay" id="octordle-results-overlay">
            <div class="octordle-results-popup">
              <button type="button" class="results-popup-close" id="results-close" aria-label="Close">×</button>
              <h2 class="octordle-results-title">You Win! 😊</h2>
              <div class="octordle-results-words">
                <div class="octordle-results-col">${rowHtml(leftCol)}</div>
                <div class="octordle-results-col">${rowHtml(rightCol)}</div>
              </div>
              <button type="button" class="btn" id="restart">Play again</button>
            </div>
          </div>
        `;
        const winsStripHtmlFinal = wins.length
          ? `<div class="octordle-wins-holder"><div class="octordle-wins-strip-inner">${winsListHtmlFinal}</div></div>`
          : '';
        root.innerHTML = `${winsStripHtmlFinal}<div class="octordle-content">${gridHtml}</div>${popupHtml}`;
        fireConfetti();
        document.getElementById('restart').onclick = () => {
          document.getElementById('confetti-container')?.remove();
          state = initState(words);
          render();
        };
        document.getElementById('results-close').onclick = closePopup;
        return;
      }

      // Regular Wordle: popup on top of grid
      if (!octordleMode) {
        const guessCount = history.length + 1;
        const wordUpper = winningWord.toUpperCase();
        const closePopup = () => {
          document.removeEventListener('keydown', onEscape);
          root.querySelector('.octordle-results-overlay')?.remove();
          root.insertAdjacentHTML('beforeend', '<button class="btn" type="button" style="margin-top:1rem" id="restart">Play again</button>');
          document.getElementById('restart').onclick = () => {
            document.getElementById('confetti-container')?.remove();
            state = initState(words);
            render();
          };
        };
        const onEscape = (e: KeyboardEvent) => {
          if (e.key === 'Escape') closePopup();
        };
        document.addEventListener('keydown', onEscape);
        const popupHtml = `
          <div class="octordle-results-overlay" id="wordle-results-overlay">
            <div class="octordle-results-popup">
              <button type="button" class="results-popup-close" id="results-close" aria-label="Close">×</button>
              <h2 class="octordle-results-title">You Win! 😊</h2>
              <div class="wordle-results-single">
                <span class="octordle-result-word">${wordUpper}</span>
                <span class="octordle-result-guesses">${guessCount}</span>
              </div>
              <button type="button" class="btn" id="restart">Play again</button>
              <a href="#" class="popup-link" id="not-the-word-btn">That wasn't the word – add the correct one</a>
            </div>
          </div>
        `;
        root.innerHTML = gridHtml + `<div class="message win">You got it!</div>` + popupHtml;
        fireConfetti();
        document.getElementById('restart').onclick = () => {
          document.getElementById('confetti-container')?.remove();
          state = initState(words);
          render();
        };
        document.getElementById('results-close').onclick = closePopup;
        (document.getElementById('not-the-word-btn') as HTMLAnchorElement).onclick = (e) => {
          e.preventDefault();
          showAddActualWordPopup(
            root,
            () => document.querySelector('#wordle-results-overlay')?.remove(),
            (word) => {
              const wrongWord = state!.winningWord;
              if (wrongWord) {
                if (!state!.currentOptions.includes(word)) state!.currentOptions.push(word);
                state!.overrideWord = wrongWord;
                state!.round = state!.history.length;
                state!.currentResult = [null, null, null, null, null];
                state!.prefillNextWord = word;
                state!.nextGuess = state!.currentOptions.length > 0 ? pickBestGuess(state!.currentOptions) : null;
                state!.nextGuessScore =
                  state!.nextGuess
                    ? scoreWordExpectedRemaining(state!.nextGuess, state!.currentOptions)
                    : null;
              } else {
                if (!state!.currentOptions.includes(word)) state!.currentOptions.push(word);
                state!.overrideWord = word;
              }
              state!.gameOver = false;
              state!.win = false;
              state!.winningWord = null;
              state!.message = null;
            },
            render
          );
        };
        return;
      }

      // Octordle round 1–7: grid + Next round (no popup) + wins sidebar
      const restartLabel = 'Next round';
      const winsListHtmlRound = (state.octordleWins || []).map(
        (w, i) =>
          `<div class="octordle-win-item"><span class="octordle-win-round">Round ${i + 1}</span> <span class="octordle-win-word">${w.word.toUpperCase()}</span> <span class="octordle-result-guesses">${w.guessCount}</span></div>`
      ).join('');
      const roundContent = `
        ${gridHtml}
        <div class="message win">You got it!</div>
        <button class="btn" type="button" style="margin-top:1rem" id="restart">${restartLabel}</button>
        <a href="#" class="popup-link" id="not-the-word-round-btn">That wasn't the word – add the correct one</a>
        ${winTableHtml}
      `;
      const winsStripHtmlRound = winsListHtmlRound
        ? `<div class="octordle-wins-holder"><div class="octordle-wins-strip-inner">${winsListHtmlRound}</div></div>`
        : '';
      root.innerHTML = `${winsStripHtmlRound}<div class="octordle-content">${roundContent}</div>`;
      fireConfetti();
      (document.getElementById('not-the-word-round-btn') as HTMLAnchorElement).onclick = (e) => {
        e.preventDefault();
        showAddActualWordPopup(
          root,
          () => {
            const c = document.querySelector('.octordle-content');
            if (c) c.innerHTML = gridHtml;
          },
          (word) => {
            const wrongWord = state!.winningWord;
            if (wrongWord) {
              if (!state!.currentOptions.includes(word)) state!.currentOptions.push(word);
              state!.overrideWord = wrongWord;
              state!.round = state!.history.length;
              state!.currentResult = [null, null, null, null, null];
              state!.prefillNextWord = word;
              state!.nextGuess = state!.currentOptions.length > 0 ? pickBestGuess(state!.currentOptions) : null;
              state!.nextGuessScore =
                state!.nextGuess
                  ? scoreWordExpectedRemaining(state!.nextGuess, state!.currentOptions)
                  : null;
            } else {
              if (!state!.currentOptions.includes(word)) state!.currentOptions.push(word);
              state!.overrideWord = word;
            }
            state!.octordleWins.pop();
            state!.gameOver = false;
            state!.win = false;
            state!.winningWord = null;
            state!.message = null;
          },
          render
        );
      };
    } else {
      const canRecolor = state.noOptionsLeft && state.history && state.history.length > 0;
      root.innerHTML = `
        <div class="message ${win ? 'win' : 'lose'}">${message}</div>
        <div class="lose-actions">
          ${canRecolor ? `<button class="btn btn-secondary" type="button" id="recolor-last">Recolor last guess</button>` : ''}
          <button class="btn" type="button" style="margin-top:1rem" id="restart">Play again</button>
        </div>
      `;
      if (canRecolor) {
        (document.getElementById('recolor-last') as HTMLButtonElement).onclick = () => {
          const last = state.history.pop();
          if (!last) return;
          state.constraints = createConstraintState();
          for (const { guess, result } of state.history) {
            applyFeedback(state.constraints, getGuessFeedback(guess, result));
          }
          state.currentOptions = words.filter(
            (w) =>
              isValidCandidate(w, state.constraints) &&
              matchesAllFeedback(w, state.history)
          );
          state.round = state.history.length;
          state.currentResult = last.result.split('');
          state.gameOver = false;
          state.win = false;
          state.message = null;
          state.noOptionsLeft = false;
          state.overrideWord = null;
          state.prefillNextWord = null;
          if (state.replayGuesses && state.round < state.replayGuesses.length) {
            state.nextGuess = null;
            state.nextGuessScore = null;
          } else {
            state.nextGuess = state.currentOptions.length > 0 ? pickBestGuess(state.currentOptions) : null;
            state.nextGuessScore = state.nextGuess
              ? scoreWordExpectedRemaining(state.nextGuess, state.currentOptions)
              : null;
          }
          render();
        };
      }
    }
    document.getElementById('restart').onclick = () => {
      document.getElementById('confetti-container')?.remove();
      if (octordleMode && win && winningWord) {
        startOctordleNextRound(state, words);
      } else {
        state = initState(words);
      }
      render();
    };
    return;
  }

  if (earlyWinnerWord && replayGuesses) {
    state.gameOver = true;
    state.win = true;
    state.winningWord = earlyWinnerWord;
    state.message = `You got it! The answer is ${earlyWinnerWord}.`;
    if (octordleMode) {
      state.octordleWins.push({ word: earlyWinnerWord, guessCount: state.history.length + 1 });
    }
    render();
    return;
  }

  const inReplay = replayGuesses && round < replayGuesses.length;
  const guess = inReplay
    ? replayGuesses[round]
    : (overrideWord ?? (round === 0 ? 'arise' : (nextGuess ?? pickBestGuess(currentOptions))));
  const guessUpper = guess.toUpperCase();
  const guessesLeft = getMaxGuesses() - (round + 1);

  let guaranteedNote = null;
  if (guessesLeft > 0 && currentOptions.length <= guessesLeft) {
    guaranteedNote = `${currentOptions.length} option(s) left and ${guessesLeft} guess(es) remaining — we're guaranteed to solve it!`;
  }

  const allFilled = currentResult.every((r) => r !== null);

  // After first guess, compute and show all remaining options with their scores
  let optionsListHtml = '';
  if (history.length >= 1 && currentOptions.length > 0) {
    const optionsWithScores = currentOptions.map((word) => {
      const s = scoreWordExpectedRemaining(word, currentOptions);
      return { word, expectedRemaining: s.expectedRemaining, maxPartitionSize: s.maxPartitionSize };
    });
    optionsWithScores.sort((a, b) => a.expectedRemaining - b.expectedRemaining || a.maxPartitionSize - b.maxPartitionSize);
    const first = optionsWithScores[0];
    const second = optionsWithScores[1];
    const scoreDetermining = !second || first.expectedRemaining < second.expectedRemaining;
    const minimaxDetermining = second && first.expectedRemaining === second.expectedRemaining && first.maxPartitionSize < second.maxPartitionSize;
    optionsListHtml = `
      <div class="options-list">
        <div class="options-list-title">Remaining options (${currentOptions.length})</div>
        <div class="options-list-scroll">
          <table class="options-table">
            <thead><tr><th class="option-word-h">Word</th><th class="option-score-h">Score</th><th class="option-max-h">Minimax</th></tr></thead>
            <tbody>
              ${optionsWithScores.map(({ word, expectedRemaining: er, maxPartitionSize: mp }, i) => {
                const scoreClass = i === 0 && scoreDetermining ? 'option-score determining' : 'option-score';
                const maxClass = i === 0 && minimaxDetermining ? 'option-max determining' : 'option-max';
                return `<tr><td class="option-word">${word}</td><td class="${scoreClass}">${er.toFixed(1)}</td><td class="${maxClass}">${mp}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  const rowsHtml = [];
  const maxRows = getMaxGuesses();
  for (let displayRow = 0; displayRow < maxRows; displayRow++) {
    const hasWinnerInsert = replayGuesses && earlyWinnerWord;
    const logicalRow = hasWinnerInsert && displayRow > replayGuesses.length ? displayRow - 1 : displayRow;

    if (hasWinnerInsert && displayRow === replayGuesses.length) {
      const winnerLetters = earlyWinnerWord.toUpperCase();
      rowsHtml.push(`<div class="row">${[...winnerLetters].map((l) => `<div class="cell filled green">${l}</div>`).join('')}</div>`);
      continue;
    }

    const isDuplicateWinnerRow = earlyWinnerWord && round >= replayGuesses.length && guess === earlyWinnerWord && logicalRow === round;
    const isPast = logicalRow < history.length;
    const isCurrent = !isDuplicateWinnerRow && logicalRow === round;
    const isReplayPending = replayGuesses && logicalRow > round && logicalRow < replayGuesses.length;
    const pastGuess = isPast ? history[logicalRow].guess.toUpperCase() : '';
    const pastResult = isPast ? history[logicalRow].result : '';
    const replayLetters = isReplayPending ? replayGuesses[logicalRow].toUpperCase() : '';
    const letters = isDuplicateWinnerRow ? '' : (isPast ? pastGuess : isCurrent ? guessUpper : isReplayPending ? replayLetters : '');
    const resultArr = isDuplicateWinnerRow ? [null, null, null, null, null] : (isPast ? [...pastResult] : isCurrent ? [...currentResult] : [null, null, null, null, null]);

    const cellsHtml = [];
    for (let col = 0; col < 5; col++) {
      const letter = letters[col] || '';
      const res = isReplayPending ? null : resultArr[col];
      const replayClass = isReplayPending ? 'replay-pending' : '';
      const cls = ['cell', resultToClass(res), isCurrent ? 'current-row' : '', letter ? 'filled' : 'empty', replayClass].filter(Boolean).join(' ');
      const dataCol = isCurrent ? ` data-col="${col}"` : '';
      cellsHtml.push(`<div class="${cls}"${dataCol}>${letter}</div>`);
    }
    rowsHtml.push(`<div class="row">${cellsHtml.join('')}</div>`);
  }

  const overridePanelHtml = overrideMode && !gameOver ? `
    <div class="override-panel" id="override-panel">
      <input type="text" id="override-input" placeholder="Enter 5-letter word" maxlength="5" autocomplete="off" />
      <button type="button" class="btn" id="override-submit">Use this word</button>
    </div>
  ` : '';

  const addWordPanelHtml = addWordMode ? `
    <div class="add-word-panel" id="add-word-panel">
      <input type="text" id="add-word-input" placeholder="5-letter word to add" maxlength="5" autocomplete="off" />
      <button type="button" class="btn" id="add-word-submit">Add</button>
    </div>
  ` : '';

  const mainContent = `
    ${overridePanelHtml}
    ${addWordPanelHtml}
    <div class="grid" id="grid">
      ${rowsHtml.join('')}
    </div>

    <div class="color-buttons">
      <button type="button" class="color-btn yellow-btn" id="btn-yellow" title="Yellow (wrong spot)">Y</button>
      <button type="button" class="color-btn green-btn" id="btn-green" title="Green (correct spot)">G</button>
      <button type="button" class="color-btn gray-btn" id="btn-gray" title="Gray (not in word)">X</button>
    </div>

    <button type="button" class="btn" id="submit" ${allFilled ? '' : 'disabled'}>Submit</button>

    <div class="stats">
      <strong>${currentOptions.length}</strong> remaining options
    </div>
    ${optionsListHtml}
    ${guaranteedNote ? `<div class="guaranteed-note">${guaranteedNote}</div>` : ''}
  `;

  if (octordleMode) {
    const winsListHtml = (state.octordleWins || []).map(
      (w, i) =>
        `<div class="octordle-win-item"><span class="octordle-win-round">Round ${i + 1}</span> <span class="octordle-win-word">${w.word.toUpperCase()}</span> <span class="octordle-result-guesses">${w.guessCount}</span></div>`
    ).join('');
    const winsStripHtml = winsListHtml
      ? `<div class="octordle-wins-holder"><div class="octordle-wins-strip-inner">${winsListHtml}</div></div>`
      : '';
    root.innerHTML = `${winsStripHtml}<div class="octordle-content">${mainContent}</div>`;
  } else {
    root.innerHTML = mainContent;
  }

  const grid = document.getElementById('grid');
  grid.querySelectorAll('.cell.current-row').forEach((cell) => {
    (cell as HTMLElement).onclick = () => {
      const col = parseInt((cell as HTMLElement).dataset.col ?? '', 10);
      state.currentResult[col] = null;
      render();
    };
  });

  const setColor = (color: 'g' | 'y' | 'x') => {
    const idx = state.currentResult.findIndex((r) => r === null);
    if (idx === -1) return;
    state.currentResult[idx] = color;
    render();
  };

  document.getElementById('btn-green').onclick = () => setColor('g');
  document.getElementById('btn-yellow').onclick = () => setColor('y');
  document.getElementById('btn-gray').onclick = () => setColor('x');

  document.getElementById('submit').onclick = () => {
    const result = state.currentResult.join('');
    if (!isValidResult(result)) return;

    if (result === 'ggggg') {
      state.gameOver = true;
      state.win = true;
      state.winningWord = guess;
      state.message = `You got it! The answer is ${guess}.`;
      if (octordleMode) {
        state.octordleWins.push({ word: guess, guessCount: state.history.length + 1 });
      }
      render();
      return;
    }

    state.history.push({ guess, result });

    const feedback = getGuessFeedback(guess, result);
    applyFeedback(state.constraints, feedback);
    state.currentOptions = state.currentOptions.filter(
      (word) =>
        isValidCandidate(word, state.constraints) &&
        matchesAllFeedback(word, state.history)
    );

    if (state.currentOptions.length === 0) {
      state.gameOver = true;
      state.win = false;
      state.noOptionsLeft = true;
      state.message = "Looks like you might have entered something wrong. Let's try again.";
      render();
      return;
    }

    if (state.currentOptions.length === 1) {
      const inReplayStill = state.replayGuesses && state.round < state.replayGuesses.length;
      if (inReplayStill) {
        state.earlyWinnerWord = state.currentOptions[0];
      } else {
        state.gameOver = true;
        state.win = true;
        state.winningWord = state.currentOptions[0];
        state.message = `You got it! The answer is ${state.currentOptions[0]}.`;
        if (octordleMode) {
          state.octordleWins.push({ word: state.winningWord, guessCount: state.history.length + 1 });
        }
        render();
        return;
      }
    }

    const left = getMaxGuesses() - (state.round + 1);
    if (left === 0 && state.currentOptions.length > 1) {
      state.gameOver = true;
      state.win = false;
      const sample = state.currentOptions.slice(0, 10).join(', ');
      const more = state.currentOptions.length > 10 ? ` … (${state.currentOptions.length} total)` : '';
      state.message = `Out of guesses. Possible answers: ${sample}${more}`;
      render();
      return;
    }

    state.round += 1;
    state.overrideWord = state.prefillNextWord ?? null;
    state.prefillNextWord = null;
    if (state.replayGuesses && state.round < state.replayGuesses.length) {
      state.nextGuess = null;
      state.nextGuessScore = null;
    } else {
      state.nextGuess = pickBestGuess(state.currentOptions);
      state.nextGuessScore = state.nextGuess
        ? scoreWordExpectedRemaining(state.nextGuess, state.currentOptions)
        : null;
    }
    state.currentResult = [null, null, null, null, null];
    render();
  };

  if (document.getElementById('override-panel')) {
    const input = document.getElementById('override-input') as HTMLInputElement;
    const submitBtn = document.getElementById('override-submit') as HTMLButtonElement;
    input.oninput = () => {
      input.value = input.value.replace(/[^a-z]/gi, '').toLowerCase().slice(0, 5);
    };
    submitBtn.onclick = () => {
      const word = (input.value || '').trim().toLowerCase();
      if (word.length !== 5) return;
      state.overrideWord = word;
      state.overrideMode = false;
      render();
    };
  }

  if (document.getElementById('add-word-panel')) {
    const input = document.getElementById('add-word-input') as HTMLInputElement;
    const submitBtn = document.getElementById('add-word-submit') as HTMLButtonElement;
    input.oninput = () => {
      input.value = input.value.replace(/[^a-z]/gi, '').toLowerCase().slice(0, 5);
    };
    submitBtn.onclick = () => {
      const word = (input.value || '').trim().toLowerCase();
      if (word.length !== 5) return;
      if (words!.includes(word)) {
        state.addWordMode = false;
        input.value = '';
        render();
        return;
      }
      saveCustomWord(word);
      words!.push(word);
      if (state.currentOptions && !state.currentOptions.includes(word)) {
        state.currentOptions.push(word);
      }
      state.addWordMode = false;
      input.value = '';
      render();
    };
  }
}

async function loadWords(): Promise<void> {
  try {
    const res = await fetch('words.json');
    if (!res.ok) throw new Error(res.statusText);
    const base: string[] = await res.json();
    const custom = getCustomWords();
    words = [...new Set([...base, ...custom])];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    document.getElementById('root')!.innerHTML =
      '<p class="error">Failed to load word list: ' + msg + '</p>';
    return;
  }
  state = null;
  const urlMode = new URLSearchParams(window.location.search).get('mode');
  octordleMode = urlMode === 'octordle';
  render();

  const optionsBtn = document.getElementById('options-btn') as HTMLElement | null;
  const optionsMenu = document.getElementById('options-menu') as HTMLElement | null;
  const menuOverride = document.getElementById('menu-override') as HTMLElement | null;
  const menuAddWord = document.getElementById('menu-add-word') as HTMLElement | null;
  const menuWordle = document.getElementById('menu-wordle') as HTMLElement | null;
  const menuOctordle = document.getElementById('menu-octordle') as HTMLElement | null;

  function updateModeButtonLabels() {
    if (menuWordle) menuWordle.textContent = octordleMode ? 'Wordle' : 'Wordle ✓';
    if (menuOctordle) menuOctordle.textContent = octordleMode ? 'Octordle ✓' : 'Octordle';
  }
  updateModeButtonLabels();

  function closeOptionsMenu() {
    optionsMenu?.classList.add('hidden');
    optionsBtn?.setAttribute('aria-expanded', 'false');
  }

  function openOptionsMenu() {
    optionsMenu?.classList.remove('hidden');
    optionsBtn?.setAttribute('aria-expanded', 'true');
  }

  optionsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (optionsMenu.classList.contains('hidden')) openOptionsMenu();
    else closeOptionsMenu();
  });

  menuOverride?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state) return;
    state.overrideMode = true;
    state.overrideWord = null;
    state.prefillNextWord = null;
    closeOptionsMenu();
    render();
  });

  menuAddWord?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state) return;
    state.addWordMode = true;
    closeOptionsMenu();
    render();
  });

  menuWordle?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!octordleMode) {
      closeOptionsMenu();
      return;
    }
    octordleMode = false;
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'wordle');
    history.replaceState(null, '', url.pathname + url.search);
    updateModeButtonLabels();
    state = initState(words);
    closeOptionsMenu();
    render();
  });

  menuOctordle?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (octordleMode) {
      closeOptionsMenu();
      return;
    }
    octordleMode = true;
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'octordle');
    history.replaceState(null, '', url.pathname + url.search);
    updateModeButtonLabels();
    state = initState(words);
    closeOptionsMenu();
    render();
  });

  optionsMenu?.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => closeOptionsMenu());

  window.addEventListener('popstate', () => {
    const urlMode = new URLSearchParams(window.location.search).get('mode');
    octordleMode = urlMode === 'octordle';
    updateModeButtonLabels();
    state = initState(words);
    render();
  });

  document.addEventListener('keydown', handleKeydown);
}

loadWords();
