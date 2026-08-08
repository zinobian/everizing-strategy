/**
 * 에버라이징 상태 저장 (구조)
 * - 기본: 메모리 + 기본값
 * - 나중에 Upstash Redis / Vercel KV 연결 가능
 *
 * 저장 내용:
 * - firstBuyDate: 종목별 첫 매수일
 * - trades: 매매 이력
 * - dcaHistory: 정액매수 금액 변경 이력
 */

const DEFAULT_STATE = {
  version: 1,
  firstBuyDate: {},   // { TQQQ: '2026-08-01', ... }
  trades: [],         // [{ date, ticker, rule, side, qty, price, note }]
  dcaHistory: [],     // [{ date, ticker, amount, note }]
  meta: {
    updatedAt: null
  }
};

// 프로세스 동안만 유지 (서버리스에서는 요청 단위로 초기화될 수 있음)
let memoryState = null;

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function loadState() {
  if (memoryState) return clone(memoryState);

  // 추후 Redis 연결 지점
  // if (process.env.UPSTASH_REDIS_REST_URL) { ... }

  memoryState = clone(DEFAULT_STATE);
  return clone(memoryState);
}

async function saveState(state) {
  state.meta = state.meta || {};
  state.meta.updatedAt = new Date().toISOString();
  memoryState = clone(state);

  // 추후 Redis 저장
  // if (process.env.UPSTASH_REDIS_REST_URL) { ... }

  return true;
}

/** 종목 첫 매수일 기록 (없을 때만) */
async function ensureFirstBuyDate(ticker, dateStr) {
  const state = await loadState();
  if (!state.firstBuyDate[ticker]) {
    state.firstBuyDate[ticker] = dateStr || new Date().toISOString().slice(0, 10);
    await saveState(state);
  }
  return state.firstBuyDate[ticker];
}

/** 투자일수 (첫 매수일 기준, 없으면 null) */
async function getHoldingDays(ticker) {
  const state = await loadState();
  const start = state.firstBuyDate[ticker];
  if (!start) return null;

  const a = new Date(start + 'T00:00:00');
  const b = new Date();
  const diff = Math.floor((b - a) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : 0;
}

/** 매매 기록 추가 */
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
  // 최근 200건만 유지
  if (state.trades.length > 200) {
    state.trades = state.trades.slice(-200);
  }
  await saveState(state);
  return state.trades;
}

/** 종목·규칙별 매매 횟수 */
async function getTradeCounts(ticker) {
  const state = await loadState();
  const list = state.trades.filter(t => t.ticker === ticker);
  const byRule = {};
  for (const t of list) {
    const key = t.rule || 'UNKNOWN';
    byRule[key] = (byRule[key] || 0) + 1;
  }
  return {
    total: list.length,
    byRule,
    dates: list.map(t => t.date)
  };
}

/** 정액매수 금액 변경 기록 */
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
