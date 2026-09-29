import { SKINS, PRESETS, STUDIO, DEFAULT_LOOK } from '../config.js';
import { CLUES } from './encounters.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['title', 'skins', 'settings', 'pause', 'gameover', 'studio', 'howto', 'shop', 'safehouse', 'journal'];

/** Thin DOM layer: screens, HUD, pops, captions. Game logic stays in main.js. */
export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.el = {
      hud: $('hud'), score: $('score'), coins: $('coins'), mult: $('mult'), powers: $('powers'),
      chase: $('chase'), chaseFill: $('chase-fill'), turn: $('turn'), zone: $('zone-banner'),
      shock: $('btn-shock'), shockFill: $('shock-fill'), hint: $('hint'), pops: $('pops'),
      intro: $('intro'), captions: $('captions'), splash: $('splash'),
    };
    for (const id of SCREENS) {
      $(id).addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act) {
          this.h.click?.();
          this.h.action(act, id);
        }
      });
    }
    $('btn-pause').addEventListener('click', () => this.h.action('pause'));
    $('btn-skip').addEventListener('click', () => this.h.action('skip'));
    for (const id of ['net', 'smoke', 'burst']) {
      $(`btn-${id}`).addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.h.action(`gadget-${id}`);
      });
    }
    this.el.shock.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.h.action('ability');
    });
    $('set-quality').addEventListener('click', () => this.h.action('toggle-quality'));
    $('set-music').addEventListener('click', () => this.h.action('toggle-music'));
    $('set-sfx').addEventListener('click', () => this.h.action('toggle-sfx'));
    for (const k of ['hoodie', 'pants', 'accent']) {
      $(`c-${k}`).addEventListener('input', (e) => this.h.customColor(k, e.target.value));
    }
    this.lastScore = -1;
    this.lastCoins = -1;
    this.studioTab = 'presets';
    $('studio-tabs').addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]')?.dataset.tab;
      if (!t) return;
      this.studioTab = t;
      this.h.click?.();
      this.h.studioRefresh?.();
    });
    $('studio-body').addEventListener('click', (e) => {
      const el = e.target.closest('[data-k]');
      if (!el || el.tagName === 'INPUT') return;
      this.h.click?.();
      this.h.look(el.dataset.k, el.dataset.v);
    });
    $('studio-body').addEventListener('input', (e) => {
      const el = e.target.closest('input[data-k]');
      if (el) this.h.look(el.dataset.k, el.value, true);
    });
  }

  /** How-to comic: render page i (with a page-flip when turning). */
  howto(pages, i, flip) {
    const pg = $('howto-page');
    const set = () => {
      pg.innerHTML = pages[i];
      $('howto-dots').textContent = pages.map((_, k) => (k === i ? '●' : '○')).join('');
    };
    if (flip) {
      pg.classList.remove('flip');
      void pg.offsetWidth;
      pg.classList.add('flip');
      setTimeout(set, 260);
    } else set();
    const next = document.querySelector('[data-act="howto-next"]');
    next.style.visibility = i === pages.length - 1 ? 'hidden' : 'visible';
  }

  /** Hero Studio: presets + body / head / suit / gear options, live on the 3D hero. */
  studio(save, look) {
    $('st-bank').textContent = save.bank.toLocaleString();
    for (const b of $('studio-tabs').children) b.classList.toggle('on', b.dataset.tab === this.studioTab);
    const chips = (k, list, labels = {}) => list.map((v) => `<button class="chip${String(look[k]) === String(v) ? ' on' : ''}" data-k="${k}" data-v="${v}">${(labels[v] || v).toString().toUpperCase()}</button>`).join('');
    const swatches = (k, list) => list.map((c) => `<button class="sw${look[k] === c ? ' on' : ''}" style="background:${c}" data-k="${k}" data-v="${c}"></button>`).join('') + `<input type="color" data-k="${k}" value="${look[k]}" />`;
    const row = (label, inner) => `<div class="st-row"><label>${label}</label><div class="st-opts">${inner}</div></div>`;
    let html = '';
    const tab = this.studioTab;
    if (tab === 'presets') {
      html = `<div class="preset-grid">${PRESETS.map((p) => {
        const L = { ...DEFAULT_LOOK, ...p.look };
        const owned = save.unlockedPresets.includes(p.id);
        return `<div class="preset${save.preset === p.id ? ' on' : ''}" data-k="preset" data-v="${p.id}"><div class="swatch">${[L.suit, L.pants, L.accent, L.hairColor].map((c) => `<i style="background:${c}"></i>`).join('')}</div>${p.name}<small>${owned ? (save.preset === p.id ? 'EQUIPPED' : 'TAP TO WEAR') : `🔒 ${p.cost} coins`}</small></div>`;
      }).join('')}</div>`;
    } else if (tab === 'body') {
      html = row('BODY', chips('body', ['A', 'B'], { A: 'Build A', B: 'Build B' })) + row('SKIN TONE', swatches('skin', STUDIO.skin));
    } else if (tab === 'head') {
      html = row('HOOD', chips('hood', ['up', 'down'])) + row('HAIR', chips('hair', STUDIO.hair)) + row('HAIR COLOUR', swatches('hairColor', STUDIO.hairColor)) +
        row('MASK', chips('mask', ['full', 'eye'], { eye: 'Eye mask' })) + row('EYES', chips('eyes', ['visor', 'goggles', 'none']));
    } else if (tab === 'suit') {
      html = row('SUIT', swatches('suit', STUDIO.colors)) + row('PATTERN', chips('pattern', STUDIO.pattern)) + row('PANTS', swatches('pants', STUDIO.colors)) +
        row('SHOES', swatches('shoes', STUDIO.colors)) + row('GLOW', swatches('accent', STUDIO.colors)) + row('TRIM', swatches('trim', STUDIO.colors)) + row('EMBLEM', chips('emblem', STUDIO.emblem));
    } else {
      html = row('BACKPACK', chips('backpack', ['true', 'false'], { true: 'On', false: 'Off' })) + row('HEADPHONES', chips('headphones', ['true', 'false'], { true: 'On', false: 'Off' })) +
        row('SCARF', chips('scarf', ['true', 'false'], { true: 'On', false: 'Off' })) + row('SCARF COLOUR', swatches('scarfColor', STUDIO.colors));
    }
    $('studio-body').innerHTML = html;
  }

  screen(name) {
    for (const id of SCREENS) $(id).classList.toggle('hidden', id !== name);
    this.current = name;
  }

  showHud(on) {
    this.el.hud.classList.toggle('hidden', !on);
  }

  hud(g) {
    const sc = Math.floor(g.score);
    if (sc !== this.lastScore) {
      this.el.score.textContent = sc.toLocaleString();
      this.lastScore = sc;
    }
    if (g.coins !== this.lastCoins) {
      this.el.coins.textContent = g.coins;
      const box = this.el.coins.parentElement;
      box.classList.remove('bump');
      void box.offsetWidth;
      box.classList.add('bump');
      this.lastCoins = g.coins;
    }
    this.el.mult.textContent = g.mult * (g.turboT > 0 ? 2 : 1);
    const cd = g.webs?.burstCool || 0;
    const bb = document.getElementById('btn-burst');
    if (bb) {
      bb.classList.toggle('cool', cd > 0);
      bb.style.setProperty('--cd', `${(1 - cd / (g.webs.burstMax || 7)) * 360}deg`);
      document.getElementById('burst-cd').textContent = cd > 0 ? Math.ceil(cd) : '';
    }
    const lv = document.getElementById('lives');
    if (lv && lv.dataset.n !== String(g.lives)) {
      lv.dataset.n = g.lives;
      lv.innerHTML = Array.from({ length: g.maxLives || 3 }, (_, i) => i).map((i) => `<span class="${i < g.lives ? '' : 'lost'}">❤</span>`).join('');
      lv.classList.remove('bump'); void lv.offsetWidth; lv.classList.add('bump');
    }

    const powers = [];
    if (g.magnetT > 0) powers.push(['MAGNET', '#ff5a7a', g.magnetT / g.cfg.magnetSec]);
    if (g.shieldOn) powers.push(['SHIELD', '#3fe0ff', g.shieldT / g.cfg.shieldSec]);
    if (g.turboT > 0) powers.push(['SKY DASH', '#ff9a2e', g.turboT / g.cfg.turboSec]);
    if (g.focusT > 0) powers.push(['FOCUS', '#9bf5d5', g.focusT / g.cfg.focusSec]);
    if (g.springT > 0) powers.push(['SUPER JUMP', '#a8f03a', g.springT / g.cfg.springSec]);
    if (g.doubleT > 0) powers.push(['COINS x2', '#ffd84a', g.doubleT / g.cfg.doubleSec]);
    const key = powers.map((p) => p[0]).join();
    if (key !== this.powerKey) {
      this.el.powers.innerHTML = powers.map((p) => `<div class="power" style="color:${p[1]}">${p[0]}<div class="bar"><i></i></div></div>`).join('');
      this.powerKey = key;
    }
    [...this.el.powers.children].forEach((c, i) => (c.querySelector('i').style.width = `${Math.max(0, powers[i][2]) * 100}%`));

    const chasing = g.strikes > 0 && g.chaseT > 0;
    this.el.chase.classList.toggle('hidden', !chasing);
    if (chasing) this.el.chaseFill.style.width = `${(g.chaseT / g.cfg.chaseWindowSec) * 100}%`;

    this.el.shockFill.style.height = `${Math.min(1, g.charge) * 100}%`;
    this.el.shock.style.setProperty('--cd', `${Math.min(1, g.charge) * 360}deg`);
    this.el.shock.classList.toggle('ready', g.charge >= 1);
    this.el.shock.classList.toggle('ready', g.charge >= 1);
  }

  turn(dir, ok, fork = null) {
    const key = `${dir}|${!!ok}|${fork ? fork.join() : ''}`;
    if (key === this.turnKey) return;
    this.turnKey = key;
    const t = this.el.turn;
    if (!dir) {
      t.classList.add('hidden');
      return;
    }
    t.classList.remove('hidden');
    t.classList.toggle('left', dir < 0);
    t.classList.toggle('ok', !!ok);
    t.classList.toggle('fork', !!fork);
    const txt = t.querySelector('.turn-text');
    if (fork && !ok) {
      // T-junction: both roads are real choices.
      txt.innerHTML = `<span class="fk l">◂ ${fork[0]}</span><small>WHICH WAY?</small><span class="fk r">${fork[1]} ▸</span>`;
    } else txt.textContent = ok ? 'NICE!' : dir < 0 ? '◂ TURN LEFT' : 'TURN RIGHT ▸';
  }

  zone(name) {
    const z = this.el.zone;
    z.classList.add('hidden');
    void z.offsetWidth;
    z.textContent = name;
    z.classList.remove('hidden');
    clearTimeout(this.zoneTimer);
    this.zoneTimer = setTimeout(() => z.classList.add('hidden'), 2700);
  }

  hint(text, ms = 3500) {
    const h = this.el.hint;
    h.textContent = text;
    h.classList.remove('hidden');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => h.classList.add('hidden'), ms);
  }

  pop(text, color = '#ffd84a', x = 50, y = 40, size) {
    const p = document.createElement('div');
    p.className = 'pop';
    p.textContent = text;
    p.style.color = color;
    p.style.left = `${x}%`;
    p.style.top = `${y}%`;
    if (size) p.style.fontSize = `${size}px`;
    this.el.pops.appendChild(p);
    setTimeout(() => p.remove(), 950);
  }

  // ── Mission objective ──
  objective(title, text, frac, boss = false) {
    const o = $('objective');
    if (!title) {
      o.classList.add('hidden');
      this.objKey = null;
      return;
    }
    o.classList.remove('hidden');
    o.classList.toggle('boss', boss);
    const key = `${title}|${text}`;
    if (key !== this.objKey) {
      $('obj-title').textContent = title;
      $('obj-text').textContent = text;
      this.objKey = key;
    }
    $('obj-fill').style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  }

  // ── Chapter cards (story beats between zones) ──
  /** Comic ink-wipe across the screen (zone changes, story beats). */
  wipe(color = '#1b1030') {
    const w = document.getElementById('wipe');
    if (!w) return;
    w.style.setProperty('--wc', color);
    w.classList.remove('go');
    void w.offsetWidth;
    w.classList.add('go');
  }

  chapter(num, title, line) {
    const c = document.getElementById('chapter');
    document.getElementById('chap-num').textContent = typeof num === 'string' ? num : `CHAPTER ${num}`;
    document.getElementById('chap-title').textContent = title;
    document.getElementById('chap-line').textContent = line;
    c.classList.add('hidden');
    void c.offsetWidth;
    c.classList.remove('hidden');
    const card = c.firstElementChild;
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
    clearTimeout(this.chapTimer);
    this.chapTimer = setTimeout(() => c.classList.add('hidden'), 3000);
  }

  // ── Comic panel mask: paper everywhere except one quad of live 3D ──
  panels(quad) {
    const svg = document.getElementById('panels');
    if (!quad) {
      svg.classList.add('hidden');
      return;
    }
    svg.classList.remove('hidden');
    const w = window.innerWidth;
    const h = window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const pts = quad.map(([x, y]) => `${(x * w).toFixed(1)} ${(y * h).toFixed(1)}`);
    const poly = `M${pts[0]} L${pts[1]} L${pts[2]} L${pts[3]} Z`;
    document.getElementById('panel-paper').setAttribute('d', `M0 0 H${w} V${h} H0 Z ${poly}`);
    document.getElementById('panel-ink').setAttribute('d', poly);
  }

  bubble(text, x, y, shout = false, ms = 2200) {
    const b = document.createElement('div');
    b.className = `bubble${shout ? ' shout' : ''}`;
    b.textContent = text;
    b.style.left = `${x}%`;
    b.style.top = `${y}%`;
    document.getElementById('bubbles').appendChild(b);
    setTimeout(() => b.remove(), ms);
  }

  clearBubbles() {
    document.getElementById('bubbles').innerHTML = '';
  }

  // ── Loading screen ──
  loading(frac, text) {
    const f = document.getElementById('load-fill');
    if (f) f.style.width = `${Math.round(frac * 100)}%`;
    if (text) document.getElementById('load-text').textContent = text;
  }

  loadingTip(text) {
    document.getElementById('load-tip').textContent = text;
  }

  bootDone() {
    const b = document.getElementById('boot');
    b.classList.add('out');
    setTimeout(() => b.classList.add('hidden'), 750);
  }

  // ── Skill chain ──
  chain(c, lastKey) {
    const box = document.getElementById('chain');
    if (!c || !c.items.length) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    document.getElementById('chain-mult').textContent = `x${c.mult.toFixed(1).replace('.0', '')}`;
    const pts = document.getElementById('chain-points');
    pts.textContent = c.points.toLocaleString();
    pts.classList.remove('bump');
    void pts.offsetWidth;
    pts.classList.add('bump');
    const list = document.getElementById('chain-list');
    const last = c.items[c.items.length - 1];
    const existing = list.lastElementChild;
    const html = `${last.label}${last.times > 1 ? ` x${last.times}` : ''}<b>+${last.pts}</b>`;
    if (existing && existing.dataset.key === last.key && last.times > 1) existing.innerHTML = html;
    else {
      const el = document.createElement('div');
      el.className = 'skill';
      el.dataset.key = last.key;
      el.innerHTML = html;
      list.appendChild(el);
      while (list.children.length > 6) list.firstElementChild.remove();
    }
    void lastKey;
  }

  chainTimer(f) {
    document.getElementById('chain-timer').style.width = `${Math.max(0, f) * 100}%`;
  }

  chainBank(total, count) {
    this.chainEnd(`+${total.toLocaleString()}<small>SKILL CHAIN · ${count} STUNTS</small>`, 'good');
  }

  chainBreak(lost) {
    this.chainEnd(`CHAIN BROKEN<small>-${lost.toLocaleString()} LOST</small>`, 'bad');
  }

  chainEnd(html, cls) {
    document.getElementById('chain').classList.add('hidden');
    document.getElementById('chain-list').innerHTML = '';
    const b = document.getElementById('chain-bank');
    b.className = cls;
    b.innerHTML = html;
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(this.bankTimer);
    this.bankTimer = setTimeout(() => b.classList.add('hidden'), 1600);
  }

  // ── Intro captions ──
  introShow(on) {
    this.el.intro.classList.toggle('hidden', !on);
    this.el.intro.classList.remove('open');
    if (!on) this.clearCaptions();
  }

  introOpen() {
    this.el.intro.classList.add('open');
  }

  caption(text, style = '', pos = { left: '6%', top: '14%' }) {
    const c = document.createElement('div');
    c.className = `caption ${style}`;
    c.innerHTML = text;
    Object.assign(c.style, pos);
    this.el.captions.appendChild(c);
    return c;
  }

  clearCaptions(animated = false) {
    for (const c of [...this.el.captions.children]) {
      if (animated) {
        c.classList.add('out');
        setTimeout(() => c.remove(), 360);
      } else c.remove();
    }
  }

  splash(on) {
    this.el.splash.classList.toggle('hidden', !on);
  }

  // ── Meta screens ──
  gadgets(save) {
    for (const id of ['net', 'smoke']) {
      const n = save.gadgets?.[id] || 0;
      const b = $(`btn-${id}`);
      b.classList.toggle('hidden', n <= 0);
      b.querySelector('i').textContent = n;
    }
  }

  shop(save, ups, gds, flash, presets = []) {
    $('sh-bank').textContent = save.bank.toLocaleString();
    const lv = (id) => save.upgrades?.[id] || 0;
    $('shop-up').innerHTML = ups.map((u) => {
      const l = lv(u.id);
      const cost = l >= u.max ? null : u.costs[l];
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
      const btn = cost === null ? '<button class="buy maxed" disabled>MAX</button>'
        : `<button class="buy ${save.bank >= cost ? 'ok' : ''}" data-act="buy-${u.id}"><i class="coin-icon"></i>${cost.toLocaleString()}</button>`;
      return `<div class="shop-card ${flash === u.id ? 'flash' : ''}"><div class="sc-icon">${u.icon}</div><div class="sc-body"><b>${u.name}</b><span>${u.desc}</span><div class="pips">${pips}</div></div>${btn}</div>`;
    }).join('');
    $('shop-suits').innerHTML = presets.map((p) => {
      const owned = save.unlockedPresets.includes(p.id);
      const on = save.preset === p.id;
      const L = p.look;
      const c1 = L.suit || '#ff3fa4';
      const c2 = L.pants || '#232a5c';
      const c3 = L.accent || '#3fe0ff';
      return `<button class="suit-card ${on ? 'on' : ''} ${owned ? 'owned' : ''}" data-act="suit-${p.id}"><span class="swatch" style="background:linear-gradient(180deg, ${c1} 0 55%, ${c2} 55% 100%);box-shadow: inset 0 0 0 3px ${c3}"></span><b>${p.name}</b><i>${on ? 'WEARING' : owned ? 'OWNED' : `<i class="coin-icon"></i>${p.cost}`}</i></button>`;
    }).join('');
    $('shop-gd').innerHTML = gds.map((g) => {
      const n = save.gadgets?.[g.id] || 0;
      return `<div class="shop-card ${flash === g.id ? 'flash' : ''}"><div class="sc-icon">${g.icon}</div><div class="sc-body"><b>${g.name}${g.key ? ` <kbd>${g.key}</kbd>` : ''}</b><span>${g.desc}</span><div class="owned">OWNED ×${n}</div></div><button class="buy ${save.bank >= g.cost ? 'ok' : ''}" data-act="buy-${g.id}"><i class="coin-icon"></i>${g.cost}</button></div>`;
    }).join('');
  }

  soundChip(on, musicOn) {
    const c = $('sound-chip');
    if (!c) return;
    c.classList.toggle('on', on);
    c.querySelector('span').textContent = !on ? 'TAP FOR SOUND' : musicOn ? 'SOUND ON' : 'MUSIC OFF';
  }

  titleStats(save) {
    const ca = save.checkpointAct || 0;
    $('t-play').textContent = ca > 0 ? `CONTINUE ACT ${['I', 'II', 'III', 'IV'][ca] || ca + 1}` : 'SWING!';
    $('t-best').textContent = save.best.toLocaleString();
    $('t-bank').textContent = save.bank.toLocaleString();
  }

  settings(save) {
    const set = (id, on, a, b) => {
      const el = $(id);
      el.textContent = on ? a : b;
      el.classList.toggle('off', !on);
    };
    set('set-quality', save.quality === 'high', 'HIGH', 'LOW');
    set('set-music', save.music, 'ON', 'OFF');
    set('set-sfx', save.sfx, 'ON', 'OFF');
  }

  skins(save) {
    $('s-bank').textContent = save.bank.toLocaleString();
    const grid = $('skin-grid');
    grid.innerHTML = '';
    for (const s of SKINS) {
      const owned = save.unlocked.includes(s.id);
      const cols = s.custom ? [save.custom.hoodie, save.custom.pants, save.custom.accent] : [s.hoodie, s.pants, s.accent, s.shoes];
      const card = document.createElement('div');
      card.className = `skin-card${save.skin === s.id ? ' selected' : ''}${owned ? '' : ' locked'}`;
      card.innerHTML = `<div class="swatch">${cols.map((c) => `<i style="background:${typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c}"></i>`).join('')}</div>
        <div>${s.name}</div>
        <div class="cost">${owned ? (save.skin === s.id ? 'EQUIPPED' : 'TAP TO EQUIP') : `🔒 ${s.cost} coins`}</div>`;
      card.addEventListener('click', () => this.h.skin(s.id));
      grid.appendChild(card);
    }
    const customOwned = save.unlocked.includes('custom');
    $('custom-row').classList.toggle('hidden', !(customOwned && save.skin === 'custom'));
    $('c-hoodie').value = save.custom.hoodie;
    $('c-pants').value = save.custom.pants;
    $('c-accent').value = save.custom.accent;
  }

  gameover(r) {
    $('g-score').textContent = Math.floor(r.score).toLocaleString();
    $('g-coins').textContent = r.coins;
    $('g-bestv').textContent = r.best.toLocaleString();
    $('g-dist').textContent = Math.floor(r.dist).toLocaleString();
    $('g-bank').textContent = r.bank.toLocaleString();
    $('g-best').classList.toggle('hidden', !r.newBest);
    $('g-chap').textContent = `CHAPTER ${r.chapter || 1}`;
    $('g-act').textContent = r.act ? `${r.act.split(' — ')[0]} ${r.actPct}%` : '';
    $('g-chain').textContent = (r.bestChain || 0).toLocaleString();
    const p = r.progress;
    if (!p) return;
    const lo = r.xpFor(p.lvl1);
    const hi = r.xpFor(p.lvl1 + 1);
    $('g-level').textContent = p.lvl1;
    $('g-xpgain').textContent = `+${p.gained.toLocaleString()} XP`;
    const fill = $('g-xpfill');
    fill.style.transition = 'none';
    fill.style.width = '0%';
    requestAnimationFrame(() => {
      fill.style.transition = 'width 1.2s cubic-bezier(.2,.8,.2,1)';
      fill.style.width = `${Math.min(100, ((p.xp - lo) / (hi - lo)) * 100)}%`;
    });
    $('g-levelup').classList.toggle('hidden', p.lvl1 === p.lvl0);
    $('g-levelup').textContent = `LEVEL UP! +${p.levelBonus} COINS`;
    $('g-ach').innerHTML = p.fresh.map((a) => `<div class="ach"><b>★ ${a.name}</b><span>${a.desc}</span><i>+${a.coins}</i></div>`).join('');
    $('g-achn').textContent = r.achDone;
    $('g-bonus').classList.toggle('hidden', !r.coinBonus);
    $('g-bonus').textContent = `COIN DOUBLER +${r.coinBonus || 0}`;
    const goal = r.goal;
    $('g-goal').classList.toggle('hidden', !goal);
    if (goal) {
      $('g-goaltxt').innerHTML = r.bank >= goal.cost ? `<b>${goal.name}</b> is ready. Hit the SHOP!` : `NEXT: <b>${goal.name}</b> — ${(goal.cost - r.bank).toLocaleString()} coins to go`;
      $('g-goalfill').style.width = `${Math.min(100, (r.bank / goal.cost) * 100)}%`;
    }
    $('g-shop').classList.toggle('glow', !!r.canShop);
    $('g-acht').textContent = r.achTotal;
  }

  clue(n, total, title, text) {
    const c = $('clue-card');
    c.innerHTML = `<small>CASE FILE ${n} / ${total}</small><b>${title}</b><span>${text}</span>`;
    c.classList.remove('hidden', 'show');
    void c.offsetWidth;
    c.classList.add('show');
    clearTimeout(this.clueT);
    this.clueT = setTimeout(() => c.classList.add('hidden'), 4200);
  }

  /** Small non-blocking act banner (does not pause play, unlike the old chapter card). */
  actToast(title, text) {
    this.zone(title.length > 24 ? title.split('—')[0].trim() : title);
  }

  safehouse(act, actIdx, save, lives, maxLives) {
    document.getElementById('sh-act-title').textContent = act.title;
    document.getElementById('sh-act-text').textContent = act.safe;
    document.getElementById('sh-bank2').textContent = save.bank.toLocaleString();
    document.getElementById('sh-lives').innerHTML = Array.from({ length: maxLives || 3 }, (_, i) => `<span class="${i < lives ? '' : 'lost'}">❤</span>`).join('');
  }

  journal(save) {
    const ACTS_META = [
      ['ACT I — THE HOUND', 'A rift over Midtown. Something came through.'],
      ['ACT II — THE RINGMASTER', 'Rictus robs the Hexbank with a clown crew.'],
      ['ACT III — IRON ISLE', 'Every cell in the lockup just opened.'],
      ['ACT IV — MIRROR CITY', 'The rift leads up, to a city hanging upside down.'],
    ];
    const done = save.journal || [];
    document.getElementById('jr-acts').innerHTML = ACTS_META.map(([t, d], i) => {
      const unlocked = done.includes(i) || i === 0;
      return `<div class="jr-item ${unlocked ? '' : 'locked'}"><b>${unlocked ? t : '??? — LOCKED'}</b>${unlocked ? d : 'Reach this chapter\u2019s checkpoint to unlock.'}</div>`;
    }).join('');
    const clues = save.clues || [];
    document.getElementById('jr-clue-count').textContent = `${clues.length} / 22 FOUND`;
    const list = document.getElementById('jr-clues');
    if (!clues.length) {
      list.innerHTML = '<div class="jr-item locked"><b>No case files yet</b>Web the newspaper pages you find mid-run.</div>';
    } else {
      list.innerHTML = clues.map((i) => { const [t] = CLUES[i] || ['???']; return `<div class="jr-item"><b>${t}</b></div>`; }).join('');
    }
  }

  achievement(a) {
    const t = $('ach-toast');
    t.innerHTML = `<div class="ach-star">★</div><div><small>ACHIEVEMENT UNLOCKED</small><b>${a.name}</b><span>${a.desc}</span><em>+${a.coins} COINS</em></div>`;
    t.classList.remove('hidden', 'show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(this.achT);
    this.achT = setTimeout(() => t.classList.add('hidden'), 4300);
  }
}
