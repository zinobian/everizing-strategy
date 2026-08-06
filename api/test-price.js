const { getPrices } = require('../lib/price');
const CONFIG = require('../lib/config');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const tickers = CONFIG.tickerList; // ['TQQQ', 'SOXL', ...]
    const prices = await getPrices(tickers);

    return res.status(200).json({
      success: true,
      time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      prices
    });

  } catch (error) {
    console.error('시세 조회 오류:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
