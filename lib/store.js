/**
 * 에버라이징 상태 저장 (Upstash Redis)
 */

const STATE_KEY = 'everizing:state';

const DEFAULT_STATE = {
  version: 1,
  firstBuyDate: {},
  trades: [],
  dcaHistory: [],
  balanceSnapshot: null,
  kisToken: null,
  meta: {
    updatedAt: null
  }
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

async function redisGet(key) {
  const cfg = getRedisConfig();
  if (!cfg) return null;
  const res = await fetch(`${cfg.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${cfg.token}` }
  });
  const data = await res.json();
  return data.result ?? null;
}

async function redisSet(key, value) {
  const cfg = getRedisConfig();
  if (!cfg) return false;
  const res = await fetch(`${cfg.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}` }
  });
  const data = await res.json();
  return data.result === 'OK';
}

async function loadState() {
  try {
    const raw = await redisGet(STATE_KEY);
    if (!raw) return clone(DEFAULT_STATE);
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      ...clone(DEFAULT_STATE),
      ...parsed,
      firstBuyDate: parsed.firstBuyDate || {},
      trades: Array.isArray(parsed.trades) ? parsed.trades : [],
      dcaHistory: Array.isArray(parsed.dcaHistory) ? parsed.dcaHistory : [],
      balanceSnapshot: parsed.balanceSnapshot || null,
      kisToken: parsed.kisToken || null
    };
  } catch (e) {
    console.error('loadState error:', e.message);
    return clone(DEFAULT_STATE);
  }
}

async function saveState(state) {
  state.meta = state.meta || {};
  state.meta.updatedAt = new Date().toISOString();
  const cfg = getRedisConfig();
  if (!cfg) {
    console.warn('Upstash 환경변수 없음 — 저장 스킵');
    return false;
  }
  try {
    return await redisSet(STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('saveState error:', e.message);
    return false;
  }
}

async function ensureFirstBuyDate(ticker, dateStr) {
  const state = await loadState();
  if (!state.firstBuyDate[ticker]) {
    state.firstBuyDate[ticker] = dateStr || new Date().toISOString().slice(0, 10);
    await saveState(state);
  }
  return state.firstBuyDate[ticker];
}

async function getHoldingDays(ticker) {
  const state = await loadState();
  const start = state.firstBuyDate[ticker];
  if (!start) return null;
  const a = new Date(start + 'T00:00:00');
  const b = new Date();
  const diff = Math.floor((b - a) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : 0;
}

async function addTrade({ date, ticker, rule, side, qty, price, note }) {
  const state = await loadState();
  state.trades.push({
    date: date || new Date().toISOString().slice(0, 10),
    ticker,
    rule: rule || '',
    side: side || 'sell',
    qty: qty || 0,
    price: price || 0,
    note: note || ''
  });
  if (state.trades.length > 200) state.trades = state.trades.slice(-200);
  await saveState(state);
  return state.trades;
}

async function getTradeCounts(ticker) {
  const state = await loadState();
  const list = state.trades.filter(t => t.ticker === ticker);
  const byRule = {};
  for (const t of list) {
    const key = t.rule || 'UNKNOWN';
    byRule[key] = (byRule[key] || 0) + 1;
  }
  return { total: list.length, byRule, dates: list.map(t => t.date) };
}

async function addDcaChange({ date, ticker, amount, note }) {
  const state = await loadState();
  state.dcaHistory.push({
    date: date || new Date().toISOString().slice(0, 10),
    ticker: ticker || 'ALL',
    amount,
    note: note || ''
  });
  await saveState(state);
  return state.dcaHistory;
}

module.exports = {
  loadState,
  saveState,
  ensureFirstBuyDate,
  getHoldingDays,
  addTrade,
  getTradeCounts,
  addDcaChange,
  DEFAULT_STATE
};
