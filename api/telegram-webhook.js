/**
 * 승인 → 실매도 + 매매 기록 + 환율 + 재투자 안내
 */

const { sendMessage } = require('../lib/telegram');
const { sellOverseas } = require('../lib/order');
const { getRealPositions } = require('../lib/balance');
const { buildReinvestPlan, formatReinvestMessage } = require('../lib/reinvest');
const { addTrade } = require('../lib/store');
const { getUsdKrwRate } = require('../lib/fx');
const CONFIG = require('../lib/config');

function formatFx(n) {
  return Number(n).toLocaleString('ko-KR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

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
          dryRun: false
        });

        let fxLine = '';
        try {
          const fx = await getUsdKrwRate();
          if (fx.ok && fx.rate) {
            const usdValue = avgPrice * qty;
            const krwApprox = usdValue * fx.rate;
            fxLine =
              `\n💱 매도 시점 환율 <code>${formatFx(fx.rate)}</code>\n` +
              `   대략 원화 환산 <code>${Math.round(krwApprox).toLocaleString('ko-KR')}원</code>\n` +
              `   (스프레드·수수료 미반영)\n`;
          }
        } catch (e) {}

        if (result.success) {
          try {
            await addTrade({
              date: new Date().toISOString().slice(0, 10),
              ticker,
              rule: 'APPROVE_SELL',
              side: 'sell',
              qty,
              price: avgPrice,
              note: result.message || '실매도 주문'
            });
          } catch (e) {}

          const approxProceeds = (avgPrice || 0) * qty;
          const plan = buildReinvestPlan(approxProceeds, CONFIG.rules?.reinvestDays || 15);

          reply =
            `✅ <b>${from}</b> 님, <b>${ticker}</b> 실매도 주문 전송\n\n` +
            `📦 수량: ${qty}주\n` +
            `📝 ${result.message || '주문 요청 완료'}\n` +
            fxLine +
            formatReinvestMessage(ticker, plan);
        } else {
          reply =
            `❌ <b>${ticker}</b> 매도 주문 실패\n\n` +
            `📝 ${result.message || JSON.stringify(result.raw || result)}\n` +
            fxLine +
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
