// Onboarding as a comic: three quick pages that teach the rules, then a
// "ready?" page. Illustrations are inline SVG in the game's ink style.

const INK = '#1b1030';
const svg = (inner, bg = '#bfe9ff') => `<svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice"><rect width="200" height="120" fill="${bg}"/>${inner}</svg>`;
const hero = (x, y, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r})" stroke="${INK}" stroke-width="3" stroke-linecap="round">
  <circle cx="0" cy="-16" r="6" fill="#ff3fa4"/><rect x="-5" y="-19" width="10" height="3" fill="#3fe0ff" stroke="none"/>
  <line x1="0" y1="-10" x2="0" y2="4"/><line x1="0" y1="4" x2="-6" y2="14"/><line x1="0" y1="4" x2="7" y2="12"/>
  <line x1="0" y1="-7" x2="-7" y2="0"/><line x1="0" y1="-7" x2="5" y2="-20"/></g>`;
const city = `<g fill="#7b4dff" stroke="${INK}" stroke-width="3"><rect x="4" y="30" width="34" height="95"/><rect x="160" y="18" width="40" height="110"/><rect x="42" y="70" width="26" height="60"/></g>
  <g fill="#ffd84a"><rect x="12" y="40" width="6" height="8"/><rect x="24" y="40" width="6" height="8"/><rect x="12" y="56" width="6" height="8"/><rect x="170" y="30" width="6" height="8"/><rect x="184" y="30" width="6" height="8"/><rect x="170" y="48" width="6" height="8"/></g>`;
const burst = (x, y, fill = '#ffd84a') => `<polygon points="${[...Array(16)].map((_, i) => { const r = i % 2 ? 7 : 16; const a = (i / 16) * Math.PI * 2; return `${x + Math.cos(a) * r},${y + Math.sin(a) * r}`; }).join(' ')}" fill="${fill}" stroke="${INK}" stroke-width="2.5"/>`;

export const HOWTO_PAGES = [
  `<h3><small>PAGE 1</small>SWING</h3>
  <div class="pnl wide">${svg(`${city}<path d="M40 60 Q100 125 160 55" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="5 5"/><line x1="100" y1="95" x2="165" y2="24" stroke="#3fe0ff" stroke-width="4"/>${hero(100, 102, 35)}${burst(165, 24, '#fff')}`)}<div class="cap">Lines fire on their own. <b>AIM</b> at a wall, lamp or tree and <b>HOLD</b> to grapple it; let go on the upswing to fling. <b>CLICK / TAP</b> (right side) to shoot web: wrap obstacles, stop trucks.</div></div>
  <div class="pnl">${svg(`<path d="M20 30 Q100 130 180 30" fill="none" stroke="${INK}" stroke-width="3"/>${burst(160, 50)}<text x="126" y="30" font-family="Bangers,Impact" font-size="16" fill="${INK}">LET GO!</text>${hero(160, 62, -40)}`, '#ffe3ef')}<div class="cap">Let go on the <b>upswing</b> = PERFECT release + speed.</div></div>
  <div class="pnl">${svg(`<circle cx="100" cy="64" r="10" fill="#fff" stroke="${INK}" stroke-width="3"/><path d="M100 50 L100 20 M92 28 L100 18 L108 28 M86 64 L40 64 M48 56 L38 64 L48 72 M114 64 L160 64 M152 56 L162 64 L152 72" stroke="${INK}" stroke-width="4" fill="none"/><text x="70" y="108" font-family="Bangers,Impact" font-size="15" fill="${INK}">AIM WITH THE POINTER</text>`, '#e8fff1')}<div class="cap">Aim: left/right picks the side, <b>higher = bigger arcs</b>.</div></div>`,

  `<h3><small>PAGE 2</small>DODGE</h3>
  <div class="pnl wide">${svg(`<polygon points="60,120 88,20 112,20 140,120" fill="#4a4470" stroke="${INK}" stroke-width="3"/><line x1="83" y1="120" x2="95" y2="20" stroke="#fff" stroke-dasharray="6 6" stroke-width="2"/><line x1="117" y1="120" x2="105" y2="20" stroke="#fff" stroke-dasharray="6 6" stroke-width="2"/><path d="M60 80 L30 80 M38 72 L28 80 L38 88 M140 80 L170 80 M162 72 L172 80 L162 88" stroke="${INK}" stroke-width="5" fill="none"/><polygon points="120,30 150,30 150,22 170,38 150,54 150,46 120,46" fill="#ffd84a" stroke="${INK}" stroke-width="3"/>${hero(100, 96)}`, '#ffd0c0')}<div class="cap"><b>SWIPE ◂ ▸</b> / arrow keys to switch lanes — and to take corners at the arrow signs.</div></div>
  <div class="pnl">${svg(`<rect x="120" y="70" width="70" height="40" fill="#b8bfd6" stroke="${INK}" stroke-width="3"/><path d="M20 100 Q50 40 80 80 Q105 20 130 55 Q150 20 170 60" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="4 4"/>${hero(160, 60)}<text x="14" y="24" font-family="Bangers,Impact" font-size="18" fill="#ff3fa4">x3!</text>`, '#dff3ff')}<div class="cap"><b>SPACE / ▲ / right-click</b> (touch: tap left side) to hop — up to a TRIPLE jump. Ride on trains &amp; buses.</div></div>
  <div class="pnl">${svg(`<rect x="60" y="20" width="90" height="36" fill="#ff3fa4" stroke="${INK}" stroke-width="3"/><line x1="62" y1="0" x2="62" y2="20" stroke="${INK}" stroke-width="3"/><line x1="148" y1="0" x2="148" y2="20" stroke="${INK}" stroke-width="3"/>${hero(100, 100, 70)}<path d="M40 110 L170 110" stroke="${INK}" stroke-width="3"/>`, '#fff6d8')}<div class="cap"><b>SWIPE ▾ / ▼</b> to dive under signs and ink bats.</div></div>`,

  `<h3><small>PAGE 3</small>SURVIVE</h3>
  <div class="pnl wide">${svg(`<rect width="200" height="120" fill="#1d1033"/><ellipse cx="70" cy="55" rx="12" ry="6" fill="#ff2fd0"/><ellipse cx="130" cy="55" rx="12" ry="6" fill="#ff2fd0"/><ellipse cx="96" cy="44" rx="7" ry="4" fill="#ff2fd0"/><ellipse cx="104" cy="44" rx="7" ry="4" fill="#ff2fd0"/><path d="M50 85 L60 100 L70 85 L80 100 L90 85 L100 100 L110 85 L120 100 L130 85 L140 100 L150 85" fill="#fff" stroke="#fff" stroke-width="2"/>`, '#1d1033')}<div class="cap">Get hit and the <b>INK HOUND</b> lunges. Get hit again while it's close: <b>CAUGHT</b>.</div></div>
  <div class="pnl">${svg(`<rect x="30" y="24" width="140" height="70" fill="#fff8e6" stroke="${INK}" stroke-width="3" transform="rotate(-3 100 60)"/><text x="52" y="54" font-family="Bangers,Impact" font-size="16" fill="#7b4dff">SKILL CHAIN x2</text><text x="66" y="82" font-family="Bangers,Impact" font-size="24" fill="${INK}">12,450</text>`, '#ffe9a8')}<div class="cap">Chain stunts before the timer runs out to <b>bank</b> them.</div></div>
  <div class="pnl">${svg(`<circle cx="60" cy="60" r="22" fill="#ffc21a" stroke="${INK}" stroke-width="4"/><path d="M62 44 L52 62 L60 62 L56 76 L68 56 L60 56 Z" fill="#fff"/>${burst(140, 60, '#3fe0ff')}<rect x="118" y="86" width="44" height="26" fill="#ffd84a" stroke="${INK}" stroke-width="3"/><text x="133" y="106" font-family="Bangers,Impact" font-size="20" fill="#ff3fa4">?</text>`, '#e3dcff')}<div class="cap"><b>COINS</b> charge your SHOCKWAVE (E). <b>?</b> boxes are surprises.</div></div>`,

  `<h3><small>ALL SET</small>READY, HERO?</h3>
  <div class="pnl wide">${svg(`${city}${burst(100, 50, '#ffd84a')}${hero(100, 70, -10)}`, '#ffb38a')}<div class="cap">Make them yours in the <b>HERO STUDIO</b> — or just swing.</div></div>
  <div class="pnl" style="justify-content:center;align-items:center;min-height:90px"><button class="btn" data-act="howto-custom">CUSTOMIZE HERO</button></div>
  <div class="pnl" style="justify-content:center;align-items:center;min-height:90px"><button class="btn primary" data-act="howto-go">JUST SWING!</button></div>`,
];
