// Notes remain local. Stored content must never become executable markup.
export function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}

export function sanitizeStore(value) {
  const notes = Object.create(null), tags = Object.create(null);
  if (!value || typeof value !== 'object') return {notes, tags};
  for (const [rawId, entries] of Object.entries(value.notes || {})) {
    if (!/^\d{1,3}$/.test(rawId) || (Number(rawId) < 101 || Number(rawId) > 999) || !Array.isArray(entries)) continue;
    notes[String(Number(rawId))] = entries.slice(-50).filter(n => n && typeof n.text === 'string').map(n => ({
      text: n.text.slice(0, 800), by: typeof n.by === 'string' ? n.by.slice(0, 50) : 'You',
      when: typeof n.when === 'string' ? n.when.slice(0, 50) : ''
    }));
  }
  for (const [rawId, genus] of Object.entries(value.tags || {})) {
    if (/^\d{1,3}$/.test(rawId) && Number(rawId) >= 101 && Number(rawId) <= 999 && Number.isInteger(genus) && genus >= 0 && genus < 6) tags[String(Number(rawId))] = genus;
  }
  return {notes, tags};
}
