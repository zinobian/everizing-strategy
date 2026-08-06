/**
 * 포지션 / 평단가 / 수익률 관리
 */

/**
 * 포지션 데이터 예시 형태
 * {
 *   TQQQ: { qty: 10, avgPrice: 65.5, costUsd: 655 },
 *   SOXL: { qty: 5, avgPrice: 120.0, costUsd: 600 }
 * }
 */

/**
 * 단일 종목 수익률 계산
 */
function calcReturn(avgPrice, currentPrice) {
  if (!avgPrice || avgPrice <= 0) return 0;
  return ((currentPrice - avgPrice) / avgPrice) * 100;
}

/**
 * 포지션 + 시세로 종목별 상태 만들기
 * @param {Object} positions - { TQQQ: { qty, avgPrice }, ... }
 * @param {Object} prices - getPrices() 결과
 * @returns {Array} 종목별 상세 현황
 */
function buildPortfolioStatus(positions, prices) {
  const list = [];

  for (const [ticker, pos] of Object.entries(positions || {})) {
    const qty = Number(pos.qty || 0);
    const avgPrice = Number(pos.avgPrice || 0);
    const current = prices[ticker]?.price || 0;

    const evalAmount = qty * current;          // 평가금액 (USD)
    const costAmount = qty * avgPrice;         // 매수원금 (USD)
    const pnl = evalAmount - costAmount;       // 손익 (USD)
    const returnPct = calcReturn(avgPrice, current);

    list.push({
      ticker,
      qty,
      avgPrice: Number(avgPrice.toFixed(4)),
      currentPrice: current,
      evalAmount: Number(evalAmount.toFixed(2)),
      costAmount: Number(costAmount.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      returnPct: Number(returnPct.toFixed(2)),
      change: prices[ticker]?.change || 0
    });
  }

  return list;
}

/**
 * 전체 요약
 */
function summarize(portfolioList) {
  const totalCost = portfolioList.reduce((s, p) => s + p.costAmount, 0);
  const totalEval = portfolioList.reduce((s, p) => s + p.evalAmount, 0);
  const totalPnl = totalEval - totalCost;
  const totalReturn = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return {
    totalCost: Number(totalCost.toFixed(2)),
    totalEval: Number(totalEval.toFixed(2)),
    totalPnl: Number(totalPnl.toFixed(2)),
    totalReturn: Number(totalReturn.toFixed(2)),
    positionCount: portfolioList.filter(p => p.qty > 0).length
  };
}

/**
 * 익절 도달 여부 체크 (규칙1 기본)
 * @param {number} returnPct - 수익률 (%)
 * @param {number} threshold - 0.15 = 15%
 */
function isProfitTarget(returnPct, threshold = 0.15) {
  return returnPct >= threshold * 100;
}

module.exports = {
  calcReturn,
  buildPortfolioStatus,
  summarize,
  isProfitTarget
};
