const { getPrices } = require('../lib/price');
const { buildPortfolioStatus, summarize, isProfitTarget } = require('../lib/portfolio');
const CONFIG = require('../lib/config');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // 테스트용 가상 포지션 (실제 계좌 대신)
    const mockPositions = {
      TQQQ: { qty: 20, avgPrice: 60.0 },
      SOXL: { qty: 10, avgPrice: 110.0 },
      GDXU: { qty: 15, avgPrice: 100.0 },
      DFEN: { qty: 8,  avgPrice: 80.0 }
    };

    const prices = await getPrices(Object.keys(mockPositions));
    const portfolio = buildPortfolioStatus(mockPositions, prices);
    const summary = summarize(portfolio);

    // 익절 후보 표시
    const signals = portfolio
      .filter(p => isProfitTarget(p.returnPct, CONFIG.rules.profitNormal))
      .map(p => ({
        ticker: p.ticker,
        returnPct: p.returnPct,
        signal: '규칙1 익절 후보 (+15%)'
      }));

    return res.status(200).json({
      success: true,
      time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      summary,
      portfolio,
      signals
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
