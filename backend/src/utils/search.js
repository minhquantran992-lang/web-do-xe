const removeDiacritics = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');

const normalizeForSearch = (value) =>
  removeDiacritics(String(value || '').toLowerCase())
    .replace(/[\s\-_.]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();

const buildSearchText = (...parts) => normalizeForSearch(parts.filter(Boolean).join(' '));

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { normalizeForSearch, buildSearchText, escapeRegex };

