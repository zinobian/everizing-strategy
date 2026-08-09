/**
 * 에버라이징 규칙 엔진 (설명서 v-final)
 * 같은 날 판정 순서: 규칙3 → 규칙1/2 → 규칙4
 * 중요도(전략): 규칙1이 기본 엔진
 */

const CONFIG = require('./config');

const BREAK_DAYS = 10; // 규칙3: 240일선 연속 하회 일수

/**
 * @param {string} ticker
 * @param {object} position - { qty, avgPrice }
 * @param {object} price - { price }
 * @param {object} daily - indicators
 * @param {object} arm - { stopArmed, athArmed, below240Days }
 */
function evaluateRules(ticker, position, price, daily, arm = {}) {
  const avgPrice = position?.avgPrice || 0;
  const current = price?.price || daily?.lastClose || 0;
  const qty = position?.qty || 0;

  if (!avgPrice || !current || qty <= 0) {
    return {
      ticker,
      signals: [],
      returnPct: 0,
      status: 'no_position',
      arm
    };
  }

  const returnPct = ((current - avgPrice) / avgPrice) * 100;
  const signals = [];

  const stopArmed = arm.stopArmed !== false;
  const athArmed = !!arm.athArmed;
  const below240Days = arm.below240Days || 0;

  const profitNormal = (CONFIG.rules?.profitNormal ?? 0.15) * 100;
  const profitBoost = (CONFIG.rules?.profitBoost ?? 0.25) * 100;
  const aboveMonthly10 = daily?.aboveMonthly10 === true;

  // ===== 규칙3: 브레이크스탑 (최우선 판정) =====
  if (
    stopArmed &&
    daily?.ma240 != null &&
    current < daily.ma240 &&
    below240Days >= BREAK_DAYS
  ) {
    signals.push({
      type: 'RULE3_BREAKSTOP',
      level: daily.ma240,
      message: `규칙3 손절 (240일선 ${BREAK_DAYS}일 연속 하회)`,
      priority: 0,
      postAction: 'disarm_stop_reinvest15'
    });
  }

  // ===== 규칙1 / 규칙2: 익절 (3이 없을 때만 의미 있게 사용) =====
  const profitTarget = aboveMonthly10 ? profitBoost : profitNormal;
  if (returnPct >= profitTarget) {
    signals.push({
      type: aboveMonthly10 ? 'RULE2_TAKE_PROFIT' : 'RULE1_TAKE_PROFIT',
      level: profitTarget,
      message: aboveMonthly10
        ? `규칙2 익절 후보 (+${profitTarget}%, 월봉10 상향)`
        : `규칙1 익절 후보 (+${profitTarget}%)`,
      priority: 1,
      postAction: 'reinvest15'
    });
  }

  // ===== 규칙4: ATH 트레일링 (신고가 무장 + 35일선 하회) =====
  if (
    athArmed &&
    daily?.ma35 != null &&
    current < daily.ma35
  ) {
    signals.push({
      type: 'RULE4_ATH_TRAIL',
      level: daily.ma35,
      message: `규칙4 ATH 트레일링 (신고가 무장 후 35일선 하회) → 워터필링`,
      priority: 2,
      postAction: 'disarm_ath_waterfill'
    });
  }

  // 우선순위: 숫자 작은 것 먼저 → 같은 날 실적용은 최상위 1개만 권장
  signals.sort((a, b) => a.priority - b.priority);
  const primary = signals.length ? signals[0] : null;

  return {
    ticker,
    qty,
    avgPrice,
    current,
    returnPct: Number(returnPct.toFixed(2)),
    ma35: daily?.ma35 ?? null,
    ma240: daily?.ma240 ?? null,
    monthly10: daily?.monthly10 ?? null,
    aboveMonthly10: daily?.aboveMonthly10 ?? null,
    arm: {
      stopArmed,
      athArmed,
      below240Days
    },
    signals,
    primary,
    status: signals.length ? 'action' : 'hold'
  };
}

/**
 * 여러 종목 — armMap: { TQQQ: armState, ... }
 */
function evaluateAll(positions, prices, dailies, armMap = {}) {
  const results = [];
  for (const ticker of Object.keys(positions)) {
    results.push(
      evaluateRules(
        ticker,
        positions[ticker],
        prices[ticker],
        dailies[ticker],
        armMap[ticker] || {}
      )
    );
  }
  return results;
}

module.exports = {
  evaluateRules,
  evaluateAll,
  BREAK_DAYS
};
