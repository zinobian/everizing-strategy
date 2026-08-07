/**
 * 에버라이징 규칙 엔진
 */

const CONFIG = require('./config');

/**
 * 종목 1개에 대한 규칙 판단
 * @param {Object} position - { qty, avgPrice }
 * @param {Object} price - { price, prevClose, change }
 * @param {Object} daily - getDailyIndicators 결과
 */
function evaluateRules(ticker, position, price, daily) {
  const avgPrice = position?.avgPrice || 0;
  const current = price?.price || daily?.lastClose || 0;
  const qty = position?.qty || 0;

  if (!avgPrice || !current || qty <= 0) {
    return {
      ticker,
      signals: [],
      returnPct: 0,
      status: 'no_position'
    };
  }

  const returnPct = ((current - avgPrice) / avgPrice) * 100;
  const signals = [];

  // ===== 규칙1: 기본 익절 +15% =====
  const profitNormal = CONFIG.rules.profitNormal * 100; // 15
  const profitBoost = CONFIG.rules.profitBoost * 100;   // 25

  // 규칙2 준비: 월봉10은 아직 미구현 → 일단 기본 15%만
  // 나중에 aboveMonthly10 넣으면 25%로 상향
  const boost = false;
  const profitTarget = boost ? profitBoost : profitNormal;

  if (returnPct >= profitTarget) {
    signals.push({
      type: boost ? 'RULE2_TAKE_PROFIT' : 'RULE1_TAKE_PROFIT',
      level: profitTarget,
      message: boost
        ? `규칙2 익절 후보 (+${profitTarget}%, 월봉10 상향)`
        : `규칙1 익절 후보 (+${profitTarget}%)`,
      priority: 1
    });
  }

  // ===== 규칙4: 35일선 이탈 (ATH 근처일 때만 의미 있음) =====
  if (daily?.ok && daily.ma35 != null) {
    const belowMa35 = current < daily.ma35;
    // 신고가 대비 많이 빠진 뒤 35MA 이탈을 트레일링으로 본다
    if (belowMa35 && daily.ath && current < daily.ath * 0.95) {
      signals.push({
        type: 'RULE4_TRAILING',
        level: daily.ma35,
        message: `규칙4 트레일링 후보 (35일선 ${daily.ma35} 하회)`,
        priority: 2
      });
    }
  }

  // ===== 규칙3: 240일선 (데이터 부족 시 스킵) =====
  if (daily?.ok && daily.ma240 != null && daily.below240Days >= CONFIG.rules.breakConfirmDays) {
    signals.push({
      type: 'RULE3_BREAKSTOP',
      level: daily.ma240,
      message: `규칙3 손절 후보 (240일선 ${CONFIG.rules.breakConfirmDays}일 연속 하회)`,
      priority: 0 // 손절 우선
    });
  }

  // 우선순위 정렬 (손절 먼저)
  signals.sort((a, b) => a.priority - b.priority);

  return {
    ticker,
    qty,
    avgPrice,
    current,
    returnPct: Number(returnPct.toFixed(2)),
    ma35: daily?.ma35 ?? null,
    ma240: daily?.ma240 ?? null,
    signals,
    status: signals.length ? 'action' : 'hold'
  };
}

/**
 * 여러 종목 일괄 평가
 */
function evaluateAll(positions, prices, dailies) {
  const results = [];

  for (const ticker of Object.keys(positions)) {
    results.push(
      evaluateRules(
        ticker,
        positions[ticker],
        prices[ticker],
        dailies[ticker]
      )
    );
  }

  return results;
}

module.exports = {
  evaluateRules,
  evaluateAll
};
