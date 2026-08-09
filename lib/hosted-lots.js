/**
 * 대여랏 · 캐쉬파킹
 * 일일 틱 + 80일 원금 회복 시 정산 자동 시작
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

async function getCashParking() {
  const state = await loadState();
  return state.cashParking || { TECL: 0 };
}

/**
 * @param {object} waterfillResult
 * @param {string} tradeDate
 * @param {object} hostPrices - { TQQQ: 74.5, ... } 생성 시점 host 가격
 */
async function createHostedLotsFromWaterfill(waterfillResult, tradeDate, hostPrices = {}) {
  const lots = await getHostedLots();
  const created = [];
  const date = tradeDate || new Date().toISOString().slice(0, 10);

  for (const a of waterfillResult.allocations || []) {
    if (!a.amountUsd || a.amountUsd < 0.01) continue;
    const hostPx = hostPrices[a.host] || 0;
    const lot = {
      id: newId(),
      origin: waterfillResult.origin,
      host: a.host,
      principalUsd: a.amountUsd,
      remainingInflowUsd: a.amountUsd,
      inflowDaysLeft: INFLOW_DAYS,
      ageTradingDays: 0,
      status: 'inflow',
      settleRemainingUsd: 0,
      settleDaysLeft: 0,
      hostPriceAtCreate: hostPx,
      createdAt: date
    };
    lots.push(lot);
    created.push(lot);
  }

  const state = await loadState();
  state.hostedLots = lots;
  if (waterfillResult.parking > 0) {
    if (!state.cashParking) state.cashParking = { TECL: 0 };
    state.cashParking.TECL = (state.cashParking.TECL || 0) + waterfillResult.parking;
  }
  await saveState(state);
  return created;
}

async function hostedPrincipalByHost() {
  const lots = await getHostedLots();
  const map = {};
  for (const lot of lots) {
    if (lot.status === 'done') continue;
    map[lot.host] = (map[lot.host] || 0) + (lot.principalUsd || 0);
  }
  return map;
}

async function tickHostedLots() {
  const lots = await getHostedLots();
  const inflowOrders = [];
  const settleOrders = [];

  for (const lot of lots) {
    if (lot.status === 'done') continue;

    lot.ageTradingDays = (lot.ageTradingDays || 0) + 1;

    if (lot.status === 'inflow' && lot.inflowDaysLeft > 0) {
      const left = lot.inflowDaysLeft;
      const chunk = lot.remainingInflowUsd / left;
      lot.remainingInflowUsd = Math.max(0, lot.remainingInflowUsd - chunk);
      lot.inflowDaysLeft = left - 1;
      inflowOrders.push({
        lotId: lot.id,
        host: lot.host,
        origin: lot.origin,
        amountUsd: Number(chunk.toFixed(2)),
        daysLeft: lot.inflowDaysLeft
      });
      if (lot.inflowDaysLeft <= 0) {
        lot.status = 'holding';
        lot.remainingInflowUsd = 0;
      }
    }

    if (lot.status === 'settling' && lot.settleDaysLeft > 0) {
      const left = lot.settleDaysLeft;
      const chunk = lot.settleRemainingUsd / left;
      lot.settleRemainingUsd = Math.max(0, lot.settleRemainingUsd - chunk);
      lot.settleDaysLeft = left - 1;
      settleOrders.push({
        lotId: lot.id,
        origin: lot.origin,
        host: lot.host,
        amountUsd: Number(chunk.toFixed(2)),
        daysLeft: lot.settleDaysLeft
      });
      if (lot.settleDaysLeft <= 0) {
        lot.status = 'done';
        lot.settleRemainingUsd = 0;
      }
    }
  }

  await saveHostedLots(lots);
  return { inflowOrders, settleOrders, lots };
}

/**
 * 80일+ holding & 추정평가 >= 원금 → 정산 시작
 * 추정평가 = principal * (현재 host가 / 생성시 host가)
 * @param {object} hostPrices - { TQQQ: number, ... }
 */
async function autoStartSettlements(hostPrices = {}) {
  const lots = await getHostedLots();
  const started = [];

  for (const lot of lots) {
    if (lot.status !== 'holding') continue;
    if ((lot.ageTradingDays || 0) < MIN_AGE_DAYS) continue;

    const px0 = lot.hostPriceAtCreate || 0;
    const px1 = hostPrices[lot.host] || 0;

    let recovered = false;
    if (px0 > 0 && px1 > 0) {
      const est = lot.principalUsd * (px1 / px0);
      recovered = est >= lot.principalUsd * 0.999;
    } else {
      // 가격 정보 없으면 host 포지션 수익 여부로 약하게 판정하지 않고 스킵
      recovered = false;
    }

    if (recovered) {
      lot.status = 'settling';
      lot.settleRemainingUsd = lot.principalUsd;
      lot.settleDaysLeft = SETTLE_DAYS;
      started.push({
        lotId: lot.id,
        origin: lot.origin,
        host: lot.host,
        principalUsd: lot.principalUsd,
        estMultiple: px0 > 0 ? px1 / px0 : null
      });
    }
  }

  if (started.length) await saveHostedLots(lots);
  return started;
}

function formatMoneyFlowBlock(lots, cashParking, inflowOrders = [], settleOrders = [], started = []) {
  const active = (lots || []).filter(l => l.status !== 'done');
  const parking = (cashParking && cashParking.TECL) || 0;

  let msg = `💰 <b>돈 흐름 (대여랏 · 파킹)</b>\n`;

  if (active.length === 0 && parking <= 0 && !started.length) {
    msg += `현재 대여랏·캐쉬파킹 없음\n\n`;
    return msg;
  }

  if (parking > 0) {
    msg += `🅿️ 캐쉬파킹 TECL  <code>$${Number(parking).toFixed(2)}</code>\n`;
  }

  for (const lot of active) {
    const st =
      lot.status === 'inflow' ? '유입중' :
      lot.status === 'holding' ? '보유중' :
      lot.status === 'settling' ? '정산중' : lot.status;
    msg += `· ${lot.origin}→${lot.host}  $${Number(lot.principalUsd).toFixed(2)}  [${st}]`;
    msg += ` 나이${lot.ageTradingDays || 0}일`;
    if (lot.status === 'inflow') msg += ` 유입남${lot.inflowDaysLeft}일`;
    if (lot.status === 'settling') msg += ` 회귀남${lot.settleDaysLeft}일`;
    if ((lot.ageTradingDays || 0) >= MIN_AGE_DAYS && lot.status === 'holding') {
      msg += ` ⏳80일+원금대기`;
    }
    msg += `\n`;
  }

  if (started.length) {
    msg += `\n✅ <b>정산 시작 (원금 회복)</b>\n`;
    for (const s of started) {
      msg += `→ ${s.host}분 $${s.principalUsd} 을 ${s.origin} 으로 15일 회귀\n`;
    }
  }

  if (inflowOrders.length) {
    msg += `\n📥 <b>오늘 대여 유입 매수</b>\n`;
    for (const o of inflowOrders) {
      msg += `→ ${o.host}  $${o.amountUsd}  (origin ${o.origin}, 남 ${o.daysLeft}일)\n`;
    }
  }

  if (settleOrders.length) {
    msg += `\n📤 <b>오늘 원금 회귀 매수</b>\n`;
    for (const o of settleOrders) {
      msg += `→ ${o.origin}  $${o.amountUsd}  (from ${o.host}, 남 ${o.daysLeft}일)\n`;
    }
  }

  msg += `\n`;
  return msg;
}

module.exports = {
  createHostedLotsFromWaterfill,
  hostedPrincipalByHost,
  tickHostedLots,
  autoStartSettlements,
  getHostedLots,
  getCashParking,
  formatMoneyFlowBlock,
  INFLOW_DAYS,
  MIN_AGE_DAYS,
  SETTLE_DAYS
};
