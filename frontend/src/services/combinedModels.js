const stripDiacritics = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeToken = (s) =>
  stripDiacritics(String(s || '').trim().toLowerCase())
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const makeComboKey = ({ slotsOrder, config }) => {
  const order = Array.isArray(slotsOrder) ? slotsOrder : [];
  const cfg = config && typeof config === 'object' ? config : {};
  return order
    .map((slot) => normalizeToken(cfg?.[slot] || 'stock') || 'stock')
    .join('_');
};

const keyToConfig = ({ slotsOrder, key }) => {
  const order = Array.isArray(slotsOrder) ? slotsOrder : [];
  const tokens = String(key || '').split('_');
  const cfg = {};
  for (let i = 0; i < order.length; i++) cfg[order[i]] = tokens[i] || 'stock';
  return cfg;
};

export const resolveBestComboKey = ({ slotsOrder, modelMap, config }) => {
  const order = Array.isArray(slotsOrder) ? slotsOrder : [];
  const map = modelMap && typeof modelMap === 'object' ? modelMap : {};
  const desired = config && typeof config === 'object' ? config : {};
  const exact = makeComboKey({ slotsOrder: order, config: desired });
  if (map[exact]) return exact;
  const hasAnyNonStock = order.some((slot) => (normalizeToken(desired?.[slot] || 'stock') || 'stock') !== 'stock');
  if (!hasAnyNonStock) return '';

  const candidates = Object.keys(map);
  if (order.length === 1) {
    const want = normalizeToken(desired?.[order[0]] || 'stock') || 'stock';
    if (want !== 'stock') {
      let best = '';
      let bestLen = -1;
      for (const key of candidates) {
        const k = normalizeToken(key) || '';
        if (!k || k === 'stock') continue;
        if (k === want) return key;
        if (want.includes(k) || k.includes(want)) {
          const score = k.length;
          if (score > bestLen) {
            bestLen = score;
            best = key;
          }
        }
      }
      if (best && map[best]) return best;
    }
  }

  if (order.length > 1) {
    const nonStockSlots = order.filter((slot) => (normalizeToken(desired?.[slot] || 'stock') || 'stock') !== 'stock');
    if (nonStockSlots.length === 1) {
      const slot = nonStockSlots[0];
      const want = normalizeToken(desired?.[slot] || 'stock') || 'stock';
      if (want !== 'stock') {
        let best = '';
        let bestLen = -1;
        for (const key of candidates) {
          const rawTokens = String(key || '').split('_');
          if (rawTokens.length !== 1) continue;
          const k = normalizeToken(rawTokens[0]) || '';
          if (!k || k === 'stock') continue;
          if (k === want) return key;
          if (want.includes(k) || k.includes(want)) {
            const score = k.length;
            if (score > bestLen) {
              bestLen = score;
              best = key;
            }
          }
        }
        if (best && map[best]) return best;
      }
    }
  }
  let bestKey = '';
  let bestScore = -1;
  let bestNonStockMatches = -1;

  for (const key of candidates) {
    const cand = keyToConfig({ slotsOrder: order, key });
    let contradicts = false;
    for (const slot of order) {
      const want = normalizeToken(desired?.[slot] || 'stock') || 'stock';
      const has = normalizeToken(cand?.[slot] || 'stock') || 'stock';
      if (has !== 'stock') {
        if (want === 'stock') {
          contradicts = true;
          break;
        }
        const match = has === want || want.includes(has) || has.includes(want);
        if (!match) {
          contradicts = true;
          break;
        }
      }
    }
    if (contradicts) continue;

    let score = 0;
    let nonStockMatches = 0;
    for (const slot of order) {
      const want = normalizeToken(desired?.[slot] || 'stock') || 'stock';
      const has = normalizeToken(cand?.[slot] || 'stock') || 'stock';
      const match = has === want || (has !== 'stock' && want !== 'stock' && (want.includes(has) || has.includes(want)));
      if (match) {
        score++;
        if (want !== 'stock') nonStockMatches++;
      }
    }

    if (score > bestScore || (score === bestScore && nonStockMatches > bestNonStockMatches)) {
      bestScore = score;
      bestNonStockMatches = nonStockMatches;
      bestKey = key;
    }
  }

  return bestKey && map[bestKey] ? bestKey : '';
};

export const resolveCombinedModelUrl = ({ bike, slotsOrder, config }) => {
  const order = Array.isArray(slotsOrder) ? slotsOrder : [];
  const modelMap = bike?.combinedModels && typeof bike.combinedModels === 'object' ? bike.combinedModels : {};
  if (!order.length) return '';
  if (!modelMap || !Object.keys(modelMap).length) return '';

  const bestKey = resolveBestComboKey({ slotsOrder: order, modelMap, config });
  return bestKey ? String(modelMap[bestKey] || '').trim() : '';
};

export const normalizeVariantKey = normalizeToken;
