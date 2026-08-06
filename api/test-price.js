const { getPrices } = require('../lib/price');
const CONFIG = require('../lib/config');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const prices = await getPrices(CONFIG.tickerList);
    return res.status(200).json({
      success: true,
      time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      prices
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
