// utils/stealth-helpers.js
// Small helpers to make our scraper behave less like an obvious bot, plus
// a helper to detect whether we're running in GitHub Actions (CI) so the
// browser runs headless there automatically, while staying visible on
// your local machine so you can still watch it work.

// GitHub Actions automatically sets process.env.CI = 'true' on its runners.
// We use this to decide headless mode without needing to remember to
// change it manually every time.
function isRunningInCI() {
  return process.env.CI === 'true';
}

function getLaunchOptions() {
  return { headless: isRunningInCI() };
}

// A handful of common, real-world desktop browser user-agent strings.
// Rotating through these makes each run look like a different real visitor
// instead of the same obviously-automated browser every time.
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
];

function getRandomUserAgent() {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index];
}

// Waits a random duration between minMs and maxMs.
// Real people don't act at exact, identical intervals — this adds natural
// variation so request timing doesn't look robotic/patterned.
function randomDelay(minMs = 2000, maxMs = 5000) {
  const duration = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, duration));
}

module.exports = { getRandomUserAgent, randomDelay, getLaunchOptions };