export function resultToClass(r: string | null): string {
  if (!r) return '';
  if (r === 'g') return 'green';
  if (r === 'y') return 'yellow';
  return 'gray';
}

export function fireConfetti(): void {
  document.getElementById('confetti-container')?.remove();
  const container = document.createElement('div');
  container.id = 'confetti-container';
  const colors = ['#538d4e', '#b59f3b', '#3a3a3c', '#ffffff', '#8fbc8f', '#d4a84b'];
  const count = 100;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.setProperty('--drift', (Math.random() - 0.5) * 100 + 'px');
    container.appendChild(piece);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 5000);
}
