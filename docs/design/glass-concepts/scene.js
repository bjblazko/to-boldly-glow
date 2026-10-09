// Shared mock-up scene for the glass UI concepts. Each concept page sets
// window.CONCEPT ({ kicker, name, tagline, swatches }) and its own skin CSS;
// this script builds the identical layout so only the style differs.
(function () {
  const c = window.CONCEPT;
  const icon = (id) => `<svg class="icon" viewBox="0 0 24 24"><use href="#icon-${id}"/></svg>`;
  const grip = (extra = '') =>
    `<div class="grip ${extra}" title="Move"><span></span><span></span><span></span><span></span><span></span><span></span></div>`;
  const close = (extra = '') => `<button class="close ${extra}" aria-label="Close">${icon('close')}</button>`;
  const check = (label, on) =>
    `<label class="check ${on ? 'is-on' : ''}"><span class="box">${icon('check')}</span><span>${label}</span></label>`;
  const toggle = (label, hint, on) =>
    `<div class="switch-row"><div><div class="switch-label">${label}</div><div class="switch-hint">${hint}</div></div>` +
    `<span class="switch ${on ? 'is-on' : ''}"><i></i></span></div>`;

  document.body.insertAdjacentHTML(
    'afterbegin',
    `
<svg class="icon-sprite" aria-hidden="true" style="display:none">
  <symbol id="icon-camera" viewBox="0 0 24 24"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"/><circle cx="12" cy="13" r="3.4"/></symbol>
  <symbol id="icon-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.25"/><path d="M12 7.5V12l3.2 2"/></symbol>
  <symbol id="icon-layers" viewBox="0 0 24 24"><path d="M12 3.5 21 8.5 12 13.5 3 8.5 12 3.5Z"/><path d="M3 12.5 12 17.5 21 12.5"/><path d="M3 16.5 12 21.5 21 16.5"/></symbol>
  <symbol id="icon-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="M15.2 15.2 20 20"/></symbol>
  <symbol id="icon-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
  <symbol id="icon-play" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></symbol>
  <symbol id="icon-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></symbol>
  <symbol id="icon-book" viewBox="0 0 24 24"><path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5Z"/><path d="M12 6.5v13"/></symbol>
  <symbol id="icon-prev" viewBox="0 0 24 24"><path d="M14.5 6l-6 6 6 6"/></symbol>
  <symbol id="icon-next" viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></symbol>
</svg>

<div class="scene">
  <div class="backdrop"></div>
  <canvas class="stars"></canvas>
  <div class="wash"></div>

  <header class="caption">
    <div class="caption-kicker">${c.kicker}</div>
    <div class="caption-title">${c.name}</div>
    <div class="caption-sub">${c.tagline}</div>
    <div class="swatches">${c.swatches.map((s) => `<i style="--c:${s}"></i>`).join('')}</div>
  </header>

  <section class="panel camera" data-accent="camera">
    <div class="panel-head">
      ${grip()}
      <div class="panel-title">${icon('camera')}<span>Camera</span></div>
      ${close()}
    </div>
    <div class="panel-body">
      <button class="btn btn-primary">${icon('camera')}<span>Switch to Free-fly Camera</span></button>
      <button class="btn btn-secondary">${icon('play')}<span>Start Tour</span></button>
      <div class="field is-focused">
        ${icon('search')}
        <span class="field-text"><span class="field-value">Ti</span><span class="caret"></span><span class="field-ghost">tan</span></span>
        <span class="field-count">2</span>
      </div>
      <ul class="results">
        <li class="is-active"><span>Titan</span><em>Moon</em></li>
        <li><span>Titania</span><em>Moon</em></li>
      </ul>
      <div class="chip"><span class="chip-dot"></span><span>Following <b>Mercury</b></span>${close('chip-close')}</div>
    </div>
  </section>

  <section class="panel display" data-accent="display">
    <div class="panel-head">
      ${grip()}
      <div class="panel-title">${icon('layers')}<span>Display</span></div>
      ${close()}
    </div>
    <div class="panel-body">
      <div class="segmented"><button class="is-on">Realistic</button><button>Compact</button></div>
      ${toggle('Bloom', 'Glow around bright bodies', true)}
      ${toggle('Lens flares', 'Starburst from the Sun', false)}
      <div class="checks">
        ${check('Planet orbits', true)}
        ${check('Labels', true)}
        ${check('Milky Way', true)}
        ${check('Stars', true)}
        ${check('Comets', false)}
        ${check('Clouds', false)}
      </div>
    </div>
  </section>

  <section class="panel lesson" data-accent="learn">
    ${grip('grip-top')}
    ${close('lesson-close')}
    <div class="lesson-kicker">${icon('book')}<span>Why does the Moon have phases?</span><b>3 / 7</b></div>
    <h2 class="lesson-title">Always the Same Face</h2>
    <p class="lesson-text">The Moon turns once around itself in exactly the time it takes to go once around Earth,
      so it always shows us the same side. The far side is not dark, though: at new moon it is the far side
      that lies in full sunlight.</p>
    <div class="lesson-foot">
      <button class="round round-prev" aria-label="Previous chapter">${icon('prev')}</button>
      <div class="progress"><i class="done"></i><i class="done"></i><i class="now"></i><i></i><i></i><i></i><i></i></div>
      <span class="lesson-note">Not to scale</span>
      <button class="round round-next" aria-label="Next chapter">${icon('next')}</button>
    </div>
  </section>

  <nav class="dock">
    <button class="dock-btn" data-accent="camera">${icon('camera')}<span>Camera</span></button>
    <button class="dock-btn" data-accent="time">${icon('clock')}<span>Time</span></button>
    <button class="dock-btn is-active" data-accent="display">${icon('layers')}<span>Display</span></button>
    <button class="dock-btn" data-accent="learn">${icon('book')}<span>Learn</span></button>
  </nav>
</div>`,
  );

  // Crisp extra star layer drawn at device resolution, so the scaled-up
  // screenshot backdrop still sparkles.
  const canvas = document.querySelector('.stars');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 1600 * dpr;
  canvas.height = 1000 * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  let seed = c.seed || 7;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tints = c.starTints || ['#ffffff', '#cfe3ff', '#ffe2c4'];
  for (let i = 0; i < 520; i++) {
    const x = rand() * 1600;
    const y = rand() * 1000;
    const r = rand() < 0.94 ? 0.35 + rand() * 0.6 : 1 + rand() * 0.9;
    ctx.globalAlpha = 0.35 + rand() * 0.6;
    ctx.fillStyle = tints[Math.floor(rand() * tints.length)];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (r > 1.5) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
      g.addColorStop(0, ctx.fillStyle);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    }
  }
})();
