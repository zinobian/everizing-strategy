/**
 * 대여랏 (규칙4 워터필링 결과)
 * - 15거래일 유입(분할 매수 스케줄)
 * - 80거래일 이후 상시체크 → 원금 이상이면 15일 origin 회수
 * - 수익분은 host 귀속
 */

const { loadState, saveState } = require('./store');

const INFLOW_DAYS = 15;
const MIN_AGE_DAYS = 80;
const SETTLE_DAYS = 15;

function newId() {
  return 'HL' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function getHostedLots() {
  const state = await loadState();
  if (!Array.isArray(state.hostedLots)) state.hostedLots = [];
  return state.hostedLots;
}

async function saveHostedLots(lots) {
  const state = await loadState();
  state.hostedLots = lots;
  await saveState(state);
  return lots;
}

/** 워터필링 결과를 대여랏으로 등록 */
async function createHostedLotsFromWaterfill(waterfillResult, tradeDate) {
  const lots = await getHostedLots();
  const created = [];
  const date = tradeDate || new Date().toISOString().slice(0, 10);

  for (const a of waterfillResult.allocations || []) {
    const lot = {
      id: newId(),
      origin: waterfillResult.origin,
      host: a.host,
      principalUsd: a.amountUsd,
      remainingInflowUsd: a.amountUsd,
      inflowDaysLeft: INFLOW_DAYS,
      ageTradingDays: 0,
      status: 'inflow', // inflow | holding | settling | done
      settleRemainingUsd: 0,
      settleDaysLeft: 0,
      createdAt: date
    };
    lots.push(lot);
    created.push(lot);
  }

  // 캐쉬파킹은 대여랏이 아니라 별도 기록
  if (waterfillResult.parking > 0) {
    const state = await loadState();
    if (!state.cashParking) state.cashParking = { TECL: 0 };
    state.cashParking.TECL = (state.cashParking.TECL || 0) + waterfillResult.parking;
    state.hostedLots = lots;
    await saveState(state);
  } else {
    await saveHostedLots(lots);
  }

  return created;
}

/** 호스트별 대여 원금 합 (캡 계산용) */
async function hostedPrincipalByHost() {
  const lots = await getHostedLots();
  const map = {};
  for (const lot of lots) {
    if (lot.status === 'done') continue;
    map[lot.host] = (map[lot.host] || 0) + (lot.principalUsd || 0);
  }
  return map;
}

/**
 * 하루 경과 처리 (간단 버전: age +1, 유입 스케줄 차감 표시)
 * 실제 매수 집행은 반자동 — 안내용 금액 반환
 */
async function tickHostedLots(tradingDay = true) {
  if (!tradingDay) return { inflowOrders: [], settleOrders: [] };

  const lots = await getHostedLots();
  const inflowOrders = [];
  const settleOrders = [];

  for (const lot of lots) {
    if (lot.status === 'done') continue;

    lot.ageTradingDays = (lot.ageTradingDays || 0) + 1;

    // 유입 중
    if (lot.status === 'inflow' && lot.inflowDaysLeft > 0) {
      const chunk = lot.remainingInflowUsd / lot.inflowDaysLeft;
      lot.remainingInflowUsd = Math.max(0, lot.remainingInflowUsd - chunk);
      lot.inflowDaysLeft -= 1;
      inflowOrders.push({
        host: lot.host,
        origin: lot.origin,
        amountUsd: Number(chunk.toFixed(2)),
        lotId: lot.id
      });
      if (lot.inflowDaysLeft <= 0) {
        lot.status = 'holding';
        lot.remainingInflowUsd = 0;
      }
    }
  }

  await saveHostedLots(lots);
  return { inflowOrders, settleOrders };
}

/**
 * 80일 이후 원금 회복 시 정산 시작 (시가평가 근사: principal * priceRatio 없이
 * 호스트 전체 평가로 판정하기 어려워, 1차에서는 원금 기준으로 수동/단순화)
 * 추후 host 포지션 연동해 정교화
 */
async function tryStartSettlement(lotId, hostEvalUsd, hostCostUsd) {
  const lots = await getHostedLots();
  const lot = lots.find(l => l.id === lotId);
  if (!lot || lot.status !== 'holding') return null;
  if ((lot.ageTradingDays || 0) < MIN_AGE_DAYS) return null;

  // 단순: 호스트 평가가 원금 성격 이상이면 정산 시작 (정교화 여지)
  if (hostEvalUsd >= hostCostUsd) {
    lot.status = 'settling';
    lot.settleRemainingUsd = lot.principalUsd;
    lot.settleDaysLeft = SETTLE_DAYS;
    await saveHostedLots(lots);
    return lot;
  }
  return null;
}

module.exports = {
  createHostedLotsFromWaterfill,
  hostedPrincipalByHost,
  tickHostedLots,
  tryStartSettlement,
  getHostedLots,
  INFLOW_DAYS,
  MIN_AGE_DAYS,
  SETTLE_DAYS
};
