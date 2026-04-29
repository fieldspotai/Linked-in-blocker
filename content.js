// LinkedIn AI Post Filter — content script
// Runs on every linkedin.com page. Scans posts, scores them for AI tells,
// hides/blurs the ones above your threshold.

const DEFAULTS = {
  enabled: true,
  threshold: 4,
  mode: 'hide',        // 'hide' | 'blur'
  showBadge: true,
};

let settings = { ...DEFAULTS };
let stats = { scanned: 0, flagged: 0 };

// ---- Heuristics ---------------------------------------------------------

const AI_PHRASES = [
  ["in today's fast-paced", 2],
  ["in today's digital", 2],
  ["in the realm of", 2],
  ["in the world of", 1],
  ["let's dive in", 2],
  ["let's dive into", 2],
  ["here's the thing", 1],
  ["i'm thrilled to", 1.5],
  ["i'm excited to share", 1],
  ["i'm humbled", 1],
  ["beyond proud", 1],
  ["buckle up", 1],
  ["game-changer", 1],
  ["game changer", 1],
  ["revolutionize", 1.5],
  ["revolutionary", 1],
  ["tapestry", 3],
  ["delve into", 2],
  ["delving into", 2],
  ["leverage", 1],
  ["synergy", 2],
  ["synergies", 2],
  ["paradigm shift", 2],
  ["ecosystem", 0.5],
  ["unlock the power", 2],
  ["a testament to", 2],
  ["needle in a haystack", 1],
  ["at the end of the day", 1],
  ["moving forward", 0.5],
  ["seamlessly", 1],
  ["robust", 0.5],
  ["holistic", 0.5],
  ["cutting-edge", 0.5],
  ["bottom line", 0.5],
  ["it's not just", 2],
  ["it's not about", 1],
  ["this isn't just", 2],
  ["i'm not just", 2],
  ["we're not just", 2],
  ["what are your thoughts", 1],
  ["drop your thoughts", 1],
  ["let me know in the comments", 1],
  ["share your experience", 0.5],
  ["what's your take", 0.5],
  ["the future is", 1],
  ["the journey continues", 1],
  ["key takeaways", 1],
  ["key learnings", 1],
  ["food for thought", 1.5],
  ["lessons learned", 0.5],
];

const AI_REGEX = [
  [/^\s*\d+\s+(ways|things|reasons|lessons|tips|signs|secrets|rules|principles)\b/im, 2],
  [/^\s*(here's|here is)\s+(why|how|what)\b/im, 1],
  [/^\s*(stop|start)\s+(doing|using|saying|thinking)\b/im, 2],
  [/^\s*the\s+(secret|truth|key)\s+to\b/im, 1.5],
  [/\b(it's not|this isn't|we don't)\s[^.]{1,60}[.—]\s*(it's|this is|we)\b/i, 2],
];

function scorePost(text) {
  if (!text || text.length < 80) return { score: 0, reasons: [] };
  const lower = text.toLowerCase();
  let score = 0;
  const reasons = [];

  for (const [phrase, weight] of AI_PHRASES) {
    if (lower.includes(phrase)) {
      score += weight;
      reasons.push(phrase);
    }
  }

  for (const [regex, weight] of AI_REGEX) {
    if (regex.test(text)) {
      score += weight;
      reasons.push('pattern: ' + regex.source.slice(0, 40));
    }
  }

  const emDashes = (text.match(/—/g) || []).length;
  if (emDashes >= 3) {
    score += Math.min(emDashes - 1, 4);
    reasons.push(`${emDashes} em-dashes`);
  }

  const emojiBullets = (text.match(/(^|\n)\s*\p{Extended_Pictographic}[^\n]*[A-Z]/gu) || []).length;
  if (emojiBullets >= 3) {
    score += 2;
    reasons.push(`${emojiBullets} emoji bullets`);
  }

  const hashtags = (text.match(/#\w+/g) || []).length;
  if (hashtags >= 8) {
    score += 1;
    reasons.push(`${hashtags} hashtags`);
  }

  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length >= 6) {
    const shortLines = lines.filter(l => l.trim().length < 90).length;
    if (shortLines / lines.length > 0.7) {
      score += 1;
      reasons.push('staccato structure');
    }
  }

  return { score, reasons };
}

// ---- DOM scanning -------------------------------------------------------

function findPosts(root = document) {
  return root.querySelectorAll(
    '[data-id^="urn:li:activity"]:not([data-ai-checked]), ' +
    '.feed-shared-update-v2:not([data-ai-checked]), ' +
    '.fie-impression-container:not([data-ai-checked])'
  );
}

function getPostText(post) {
  const sel = [
    '.feed-shared-update-v2__description',
    '.update-components-text',
    '.feed-shared-text',
    '.feed-shared-inline-show-more-text',
  ].join(', ');
  const el = post.querySelector(sel);
  return el ? el.innerText : '';
}

function processPost(post) {
  if (post.dataset.aiChecked) return;
  post.dataset.aiChecked = '1';
  stats.scanned++;

  const text = getPostText(post);
  if (!text) return;

  const { score, reasons } = scorePost(text);
  post.dataset.aiScore = score.toFixed(1);

  if (settings.enabled && score >= settings.threshold) {
    flagPost(post, score, reasons);
    stats.flagged++;
  }
}

function flagPost(post, score, reasons) {
  post.classList.add('lai-flagged');
  if (settings.mode === 'hide') {
    post.classList.add('lai-hidden');
    post.setAttribute('aria-hidden', 'true');
  } else {
    post.classList.add('lai-blurred');
  }

  if (settings.showBadge) {
    const badge = document.createElement('div');
    badge.className = 'lai-badge';
    badge.innerHTML = `
      <span class="lai-badge-label">Likely AI · score ${score.toFixed(1)}</span>
      <button class="lai-badge-show" type="button">Show anyway</button>
    `;
    badge.title = 'Triggers: ' + reasons.join(', ');
    badge.querySelector('.lai-badge-show').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      post.classList.remove('lai-hidden', 'lai-blurred');
      post.removeAttribute('aria-hidden');
      badge.remove();
    });
    post.prepend(badge);
  }
}

function scan() {
  findPosts().forEach(processPost);
}

let scanTimer;
const observer = new MutationObserver(() => {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scan, 200);
});

function resetAllPosts() {
  document.querySelectorAll('[data-ai-checked]').forEach(el => {
    el.removeAttribute('data-ai-checked');
    el.removeAttribute('data-ai-score');
    el.classList.remove('lai-flagged', 'lai-hidden', 'lai-blurred');
    el.removeAttribute('aria-hidden');
  });
  document.querySelectorAll('.lai-badge').forEach(b => b.remove());
  stats = { scanned: 0, flagged: 0 };
}

function init() {
  chrome.storage.sync.get(DEFAULTS, (loaded) => {
    settings = { ...DEFAULTS, ...loaded };
    scan();
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

chrome.storage.onChanged.addListener((changes) => {
  for (const k of Object.keys(changes)) {
    if (changes[k].newValue !== undefined) settings[k] = changes[k].newValue;
  }
  resetAllPosts();
  scan();
});

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg && msg.type === 'getStats') {
    respond(stats);
    return true;
  }
});

init();
