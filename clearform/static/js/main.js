// Publication links: an empty string shows 'Coming soon'; a URL or a site-relative path enables the button.
// Keep a URL empty until its destination actually exists and is publicly accessible.
const PUBLICATION_LINKS = {
  paper: './paper/clearform.pdf',
  arxiv: 'https://arxiv.org/abs/2611.10370',
  code: '',   // e.g. 'https://github.com/YOUR-USERNAME/clearform'
};

// "More results" videos. Each file is one [rendering | depth | normal] strip.
// Bump when media files are re-encoded so browsers do not keep stale cached copies.
const MEDIA_VERSION = '20261110a';

const RESULTS = {
  translab: {
    scenes: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => [`Scene ${i}`, `translab_scene${String(i).padStart(2, '0')}.mp4`]),
  },
  real: {
    scenes: [
      ['Display cases', 'real_s1.mp4'], ['Gallery', 'real_s3.mp4'], ['Glass wall', 'real_s4.mp4'],
      ['Partition', 'real_s6.mp4'], ['Glass doors', 'real_s7.mp4'], ['Glassware', 'real_s8.mp4'],
    ],
  },
};

// ---------------------------------------------------------------- publication links
document.querySelectorAll('.publication-link[data-link-key]').forEach((placeholder) => {
  const key = placeholder.dataset.linkKey;
  const value = (PUBLICATION_LINKS[key] || '').trim();
  let url;
  if (!value) return;
  try { url = new URL(value, window.location.href); } catch { return; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  const link = document.createElement('a');
  link.className = 'publication-link is-active';
  link.href = url.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.dataset.linkKey = key;
  const label = placeholder.querySelector('.link-title')?.textContent || key;
  const icon = placeholder.querySelector('.pub-icon')?.cloneNode(true);
  const copy = document.createElement('span');
  copy.className = 'link-copy';
  const text = document.createElement('span');
  text.className = 'link-title';
  text.textContent = label;
  if (icon) link.appendChild(icon);
  copy.appendChild(text);
  link.appendChild(copy);
  link.setAttribute('aria-label', `${label} (opens in new tab)`);
  placeholder.replaceWith(link);
});

// Make one button in a tab group active.
function activate(group, btn) {
  group.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b === btn);
    b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
  });
}

// ---------------------------------------------------------------- comparison sliders
// The divider follows the mouse without clicking; the invisible range input keeps touch/keyboard working.
document.querySelectorAll('.compare').forEach((container) => {
  const range = container.querySelector('.compare-range');
  const update = () => container.style.setProperty('--split', `${range.value}%`);
  range.addEventListener('input', update);
  container.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    const rect = container.getBoundingClientRect();
    if (!rect.width) return;
    const f = (event.clientX - rect.left) / rect.width;
    range.value = String(Math.max(0, Math.min(100, f * 100)));
    update();
  });
  update();
});

// ---------------------------------------------------------------- teaser tabs
const teaser = document.getElementById('teaser-video');
document.querySelectorAll('#teaser-tabs .tab').forEach((btn) => btn.addEventListener('click', () => {
  activate(btn.parentElement, btn);
  teaser.src = btn.dataset.teaser;
  teaser.play().catch(() => {});
}));

// ---------------------------------------------------------------- 3D-FRONT-T video comparison
// Each MP4 is [method | ours] side by side; both halves come from ONE video, so they never drift.
// Both use the same 553-frame path (tools/campath.py), so switching modes keeps the camera position.
// mesh_*: TSDF meshes, 960x540 per side. render_*: RGB at every method's training resolution (480x270).
const LABELS = { gt: 'GT', pgsr: 'PGSR', tsgs: 'TSGS', glint: 'GLINT', rt: 'RT-Splatting' };
const cmp = { scene: '3', method: 'gt', mode: 'mesh' };
// Methods without results for a scene (TSGS training diverged on scene 5).
const MISSING = { 5: ['tsgs'] };
const vc = document.querySelector('.video-compare');
const video = vc.querySelector('.source-video');
const canvas = vc.querySelector('.video-canvas');
const ctx = canvas.getContext('2d');
const videoRange = vc.querySelector('.compare-range');
function drawPaired() {
  if (video.readyState >= 2 && video.videoWidth >= 2) {
    const w = Math.floor(video.videoWidth / 2), h = video.videoHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const cut = Math.round(w * Number(videoRange.value) / 100);
    if (cut > 0) ctx.drawImage(video, 0, 0, cut, h, 0, 0, cut, h);
    if (cut < w) ctx.drawImage(video, w + cut, 0, w - cut, h, cut, 0, w - cut, h);
  }
  requestAnimationFrame(drawPaired);
}
requestAnimationFrame(drawPaired);
function updateComparison(keepTime) {
  // same scene: keep the point along the camera path when switching method or mode
  const frac = keepTime && video.duration ? video.currentTime / video.duration : 0;
  video.src = `./static/videos/${cmp.mode}_${cmp.method}_vs_ours_s${cmp.scene}.mp4?v=${MEDIA_VERSION}`;
  video.addEventListener('loadedmetadata', () => {
    video.currentTime = frac * video.duration;
    video.play().catch(() => {});
  }, { once: true });
  document.getElementById('cmp-left-label').textContent = cmp.mode === 'mesh' && cmp.method === 'gt' ? 'GT mesh' : LABELS[cmp.method];
}
const methodGroup = document.querySelector('#comparisons .tabs[data-group="method"]');
function refreshMethods() {
  methodGroup.querySelectorAll('.tab').forEach((b) => {
    const m = b.dataset.value;
    // no GT images along the rendered path; some methods lack some scenes
    b.disabled = (m === 'gt' && cmp.mode === 'render') || (MISSING[cmp.scene] || []).includes(m);
  });
  const current = methodGroup.querySelector(`[data-value="${cmp.method}"]`);
  if (current.disabled) {
    cmp.method = 'pgsr';
    activate(methodGroup, methodGroup.querySelector('[data-value="pgsr"]'));
  }
}
document.querySelectorAll('#comparisons .tabs[data-group]').forEach((group) => {
  group.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => {
    activate(group, btn);
    cmp[group.dataset.group] = btn.dataset.value;
    refreshMethods();
    updateComparison(group.dataset.group !== 'scene');
  }));
});

// ---------------------------------------------------------------- more results
const resultsVideo = document.getElementById('results-video');
const sceneTabs = document.getElementById('scene-tabs');
function showDataset(key) {
  const d = RESULTS[key];
  resultsVideo.classList.toggle('square', key === 'translab');
  sceneTabs.innerHTML = '';
  d.scenes.forEach(([label, file], i) => {
    const b = document.createElement('button');
    b.className = 'tab' + (i === 0 ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => { activate(sceneTabs, b); playResult(file); });
    sceneTabs.appendChild(b);
  });
  playResult(d.scenes[0][1]);
}
function playResult(file) {
  resultsVideo.muted = true;
  resultsVideo.src = `./static/videos/results/${file}?v=${MEDIA_VERSION}`;
  resultsVideo.play().catch(() => {});
}
document.querySelectorAll('#dataset-tabs .tab').forEach((btn) => btn.addEventListener('click', () => {
  activate(btn.parentElement, btn);
  showDataset(btn.dataset.dataset);
}));
showDataset('translab');

// ---------------------------------------------------------------- BibTeX copy
document.getElementById('copy-bibtex').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  try {
    await navigator.clipboard.writeText(document.getElementById('bibtex-text').textContent);
    btn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Copied';
  } catch { btn.textContent = 'Select and copy manually'; }
  setTimeout(() => { btn.innerHTML = '<i class="far fa-copy" aria-hidden="true"></i> Copy'; }, 1600);
});
