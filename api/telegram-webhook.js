/**
 * 텔레그램 버튼 클릭 → 실제 매도 주문
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

        // 실주문
        const result = await sellOverseas({
          ticker,
          qty,
          excd,
          dryRun: false
        });

        if (result.success) {
          const approxProceeds = (avgPrice || 0) * qty;
          const plan = buildReinvestPlan(approxProceeds, CONFIG.rules.reinvestDays || 15);

          reply =
            `✅ <b>${from}</b> 님, <b>${ticker}</b> 실매도 주문 전송\n\n` +
            `📦 수량: ${qty}주\n` +
            `📝 ${result.message || '주문 요청 완료'}\n` +
            formatReinvestMessage(ticker, plan);
        } else {
          reply =
            `❌ <b>${ticker}</b> 매도 주문 실패\n\n` +
            `📝 ${result.message || JSON.stringify(result.raw || result)}\n` +
            `한투 앱에서 주문/잔고를 확인해 주세요.`;
        }
      }
    } else if (data === 'hold:all') {
      reply = `⏸ <b>${from}</b> 님이 전체 보류를 선택했습니다.`;
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
