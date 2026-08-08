/**
 * 텔레그램 버튼 클릭 수신 + 모의 매도 + 재투자 안내
 */

const { sendMessage } = require('../lib/telegram');
const { sellOverseas } = require('../lib/order');
const { getRealPositions } = require('../lib/balance');
const { buildReinvestPlan, formatReinvestMessage } = require('../lib/reinvest');
const CONFIG = require('../lib/config');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const body = req.body || {};
    const callback = body.callback_query;

    if (!callback) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const data = callback.data || '';
    const from = callback.from?.first_name || 'User';

    let reply = '';

    if (data.startsWith('approve:')) {
      const ticker = data.split(':')[1];

      let qty = 0;
      let avgPrice = 0;
      try {
        const balance = await getRealPositions();
        qty = balance.positions?.[ticker]?.qty || 0;
        avgPrice = balance.positions?.[ticker]?.avgPrice || 0;
      } catch (e) {
        qty = 0;
      }

      if (qty <= 0) {
        reply = `⚠️ <b>${from}</b> 님, <b>${ticker}</b> 보유 수량이 없어 매도할 수 없습니다.`;
      } else {
        const excd = CONFIG.tickers[ticker]?.excd || 'NAS';

        const result = await sellOverseas({
          ticker,
          qty,
          excd,
          dryRun: true
        });

        // 재투자 금액: 일단 평단*수량으로 근사 (실매도 시 체결가*수량으로 교체)
        const approxProceeds = avgPrice * qty;
        const plan = buildReinvestPlan(approxProceeds, CONFIG.rules.reinvestDays || 15);

        reply =
          `✅ <b>${from}</b> 님이 <b>${ticker}</b> 매도를 승인했습니다.\n\n` +
          `📦 수량: ${qty}주\n` +
          `🧪 모드: 모의(dryRun)\n` +
          `📝 ${result.message}\n` +
          formatReinvestMessage(ticker, plan);
      }
    } else if (data === 'hold:all') {
      reply = `⏸ <b>${from}</b> 님이 전체 보류를 선택했습니다.`;
    } else if (data === 'test_approve') {
      reply = `✅ 승인 테스트 확인되었습니다.`;
    } else if (data === 'test_hold') {
      reply = `⏸ 보류 테스트 확인되었습니다.`;
    } else {
      reply = `알 수 없는 선택: <code>${data}</code>`;
    }

    await sendMessage(reply);
    return res.status(200).json({ ok: true, handled: data });
  } catch (error) {
    console.error('webhook error:', error.message);
    try {
      await sendMessage(`❌ 웹훅 오류\n${error.message}`);
    } catch (e) {}
    return res.status(200).json({ ok: false, error: error.message });
  }
};
