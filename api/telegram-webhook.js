/**
 * 텔레그램 버튼 클릭 수신 + 모의 매도
 */

const { sendMessage } = require('../lib/telegram');
const { sellOverseas } = require('../lib/order');
const { getRealPositions } = require('../lib/balance');
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

      // 실제 잔고에서 수량 확인
      let qty = 0;
      try {
        const balance = await getRealPositions();
        qty = balance.positions?.[ticker]?.qty || 0;
      } catch (e) {
        qty = 0;
      }

      if (qty <= 0) {
        reply = `⚠️ <b>${from}</b> 님, <b>${ticker}</b> 보유 수량이 없어 매도할 수 없습니다.`;
      } else {
        const excd = CONFIG.tickers[ticker]?.excd || 'NAS';

        // 기본 dryRun=true → 실제 주문 안 함
        const result = await sellOverseas({
          ticker,
          qty,
          excd,
          dryRun: true
        });

        reply =
          `✅ <b>${from}</b> 님이 <b>${ticker}</b> 매도를 승인했습니다.\n\n` +
          `📦 수량: ${qty}주\n` +
          `🧪 모드: 모의(dryRun)\n` +
          `📝 ${result.message}\n\n` +
          `<i>실제 주문은 dryRun을 false로 바꾼 뒤 활성화됩니다.</i>`;
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
