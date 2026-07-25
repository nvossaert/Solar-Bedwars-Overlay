'use strict';
const api = window.solarBridge;

// Scatter a starfield behind the sun - randomized size/position/timing so it never
// looks like a repeating pattern. Purely decorative, generated once on load.
const starsEl = document.getElementById('stars');
const STAR_COUNT = 46;
for (let i = 0; i < STAR_COUNT; i++) {
  const s = document.createElement('div');
  s.className = 'star';
  const size = 1 + Math.random() * 1.6;
  s.style.width = size + 'px';
  s.style.height = size + 'px';
  s.style.left = Math.random() * 100 + '%';
  s.style.top = Math.random() * 100 + '%';
  s.style.animationDuration = (2.2 + Math.random() * 3) + 's';
  s.style.animationDelay = (Math.random() * 3) + 's';
  starsEl.appendChild(s);
}

// Total on-screen time before the hand-off to the overlay window. Matches the CSS
// animation timings above (letters/subtitle/credit/progress bar are all paced to fit
// inside this window) - see splash.css if this ever needs to change.
const HOLD_MS = 5000;
const FADE_MS = 500;

setTimeout(() => {
  document.getElementById('card').classList.add('leaving');
  setTimeout(() => api.splashDone(), FADE_MS);
}, HOLD_MS);
