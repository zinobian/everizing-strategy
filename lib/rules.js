/**
 * 에버라이징 규칙 엔진
 * 규칙1: +15% 익절
 * 규칙2: 월봉10 위이면 +25% 익절
 * 규칙3: 240일선 10일 연속 하회 손절
 * 규칙4: 35일선 이탈 트레일링
 */

const CONFIG = require('./config');

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

  const profitNormal = CONFIG.rules.profitNormal * 100; // 15
  const profitBoost = CONFIG.rules.profitBoost * 100;   // 25

  // 규칙2: 월봉10 위면 부스트
  const boost = daily?.aboveMonthly10 === true;
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

  // 규칙4: 35일선 이탈 트레일링
  if (daily?.ok && daily.ma35 != null) {
    const belowMa35 = current < daily.ma35;
    if (belowMa35 && daily.ath && current < daily.ath * 0.95) {
      signals.push({
        type: 'RULE4_TRAILING',
        level: daily.ma35,
        message: `규칙4 트레일링 후보 (35일선 ${daily.ma35} 하회)`,
        priority: 2
      });
    }
  }

  // 규칙3: 240일선 손절
  if (daily?.ok && daily.ma240 != null && daily.below240Days >= CONFIG.rules.breakConfirmDays) {
    signals.push({
      type: 'RULE3_BREAKSTOP',
      level: daily.ma240,
      message: `규칙3 손절 후보 (240일선 ${CONFIG.rules.breakConfirmDays}일 연속 하회)`,
      priority: 0
    });
  }

  signals.sort((a, b) => a.priority - b.priority);

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
    signals,
    status: signals.length ? 'action' : 'hold'
  };
}

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
