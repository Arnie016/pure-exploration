import { DEFAULT_LOOK } from '../config.js';

// A lightweight front-view illustration of the same outfit fields as the rig.
// Color validation keeps custom saved colors from becoming SVG markup.
const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
export function suitPreview(preset) {
  const look = { ...DEFAULT_LOOK, ...preset.look };
  const suit = color(look.suit, DEFAULT_LOOK.suit);
  const pants = color(look.pants, DEFAULT_LOOK.pants);
  const trim = color(look.trim, DEFAULT_LOOK.trim);
  const accent = color(look.accent, DEFAULT_LOOK.accent);
  const shoes = color(look.shoes, DEFAULT_LOOK.shoes);
  const face = look.mask === 'full' ? (look.outfit === 'suit' ? suit : '#1b1030') : color(look.skin, DEFAULT_LOOK.skin);
  const emblems = {
    bolt: 'M43 42 34 55H41L37 64 49 50H42Z',
    star: 'M40 43 43 50 51 51 45 56 47 64 40 60 33 64 35 56 29 51 37 50Z',
    v: 'M31 45 38 62H42L49 45H43L40 54 37 45Z',
    eye: 'M29 53Q40 40 51 53Q40 66 29 53Z',
    spiral: 'M32 53C32 42 51 43 48 55C46 64 34 60 38 52C39 49 44 51 42 55',
  };
  let detail = '';
  if (look.pattern === 'stripes') detail = `<path d="M28 45H52M28 51H52M28 57H52M28 63H52" stroke="${trim}" opacity=".55"/>`;
  else if (look.pattern === 'circuit') detail = `<path d="M30 42V49H35V61M50 42V56H46V67" fill="none" stroke="${accent}" stroke-width="2"/>`;
  else if (look.pattern !== 'solid') detail = `<path d="M29 46 34 48M48 61 51 58M30 62 33 60M47 45 50 47" stroke="${trim}" stroke-width="3" opacity=".6"/>`;
  const eyes = look.eyes === 'none' ? '' : look.eyes === 'visor'
    ? `<path d="M30 24H50" stroke="${accent}" stroke-width="5"/>`
    : `<ellipse cx="34" cy="24" rx="5" ry="3" fill="${accent}"/><ellipse cx="46" cy="24" rx="5" ry="3" fill="${accent}"/>`;
  const fitted = look.outfit === 'suit';
  return `<svg class="suit-preview" viewBox="0 0 80 112" aria-hidden="true" focusable="false"><ellipse cx="40" cy="105" rx="24" ry="4" fill="#1b1030" opacity=".14"/><g stroke="#1b1030" stroke-width="2" stroke-linejoin="round"><path d="M29 68 28 96H38L40 75 42 96H52L51 68Z" fill="${pants}"/><path d="M25 38 16 49 12 73 22 75 29 52M55 38 64 49 68 73 58 75 51 52" fill="${suit}"/><path d="M29 36Q40 31 51 36L55 69H25Z" fill="${suit}"/><path d="M28 94 26 102H39V94M42 94V102H55L52 94" fill="${shoes}"/><path d="M12 70 11 79 21 80 23 72M57 72 59 80 69 79 68 70" fill="${trim}"/>${fitted ? `<path d="M29 39 33 64M51 39 47 64" stroke="${trim}" stroke-width="4"/><path d="M28 85H38M42 85H52" stroke="${shoes}" stroke-width="6"/>` : `<path d="M29 61H51V66H29Z" fill="${trim}"/>`}${detail}<ellipse cx="40" cy="23" rx="13" ry="15" fill="${face}"/>${look.hood === 'up' ? `<path d="M25 25Q20 5 40 5Q60 5 55 25L51 18Q40 10 29 18Z" fill="${suit}"/>` : ''}${eyes}${emblems[look.emblem] ? `<path d="${emblems[look.emblem]}" fill="${look.emblem === 'spiral' ? 'none' : accent}" stroke="${accent}" stroke-width="2"/>` : ''}</g></svg>`;
}
