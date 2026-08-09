/**
 * 텔레그램 웹훅
 * - 승인/보류 버튼 → 실매도 + 재투자 안내
 * - /port, /status, 포트 → 잔고 요약
 */

const { sendMessage } = require('../lib/telegram');
const { sellOverseas } = require('../lib/order');
const { getRealPositions } = require('../lib/balance');
const { buildReinvestPlan, formatReinvestMessage } = require('../lib/reinvest');
const { addTrade } = require('../lib/store');
const { getUsdKrwRate } = require('../lib/fx');
const CONFIG = require('../lib/config');

function formatMoney(n) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatFx(n) {
  return Number(n).toLocaleString('ko-KR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

async function buildPortfolioMessage() {
  let fxLine = '';
  try {
    const fx = await getUsdKrwRate();
    if (fx.ok && fx.rate) {
      const sign = fx.change > 0 ? '+' : '';
      fxLine =
        `💱 환율 <code>${formatFx(fx.rate)}</code>` +
        (fx.change != null ? ` (${sign}${formatFx(fx.change)})` : '') +
        `\n\n`;
    }
  } catch (e) {}

  let balance;
  try {
    balance = await getRealPositions();
  } catch (e) {
    return `❌ 잔고 조회 실패\n${e.message}`;
  }

  const positions = balance.positions || {};
  const tickers = Object.keys(positions);

  if (tickers.length === 0) {
    return (
      `💼 <b>Portfolio</b>\n\n` +
      fxLine +
      `📭 보유 종목 없음\n` +
      `한투 계좌에 주식이 없습니다.`
    );
  }

  let totalCost = 0;
  let totalEval = 0;
  const rows = [];

  for (const t of tickers) {
    const p = positions[t];
    const qty = p.qty || 0;
    const avg = p.avgPrice || 0;
    const cur = p.currentPrice || avg;
    const cost = avg * qty;
    const evalAmt = cur * qty;
    const pnl = evalAmt - cost;
    const ret = cost > 0 ? (pnl / cost) * 100 : 0;
    totalCost += cost;
    totalEval += evalAmt;
    rows.push({ t, qty, avg, cur, cost, evalAmt, pnl, ret });
  }

  rows.sort((a, b) => b.ret - a.ret);
  const totalPnl = totalEval - totalCost;
  const totalRet = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  let msg = `💼 <b>Portfolio</b>\n\n`;
  msg += fxLine;
  msg += `평가 <code>$${formatMoney(totalEval)}</code>\n`;
  msg += `원금 <code>$${formatMoney(totalCost)}</code>\n`;
  msg += `손익 <code>$${formatMoney(totalPnl)}</code>  (${totalRet >= 0 ? '+' : ''}${totalRet.toFixed(2)}%)\n\n`;
  msg += `📋 <b>종목 (수익률순)</b>\n`;

  for (const r of rows) {
    const icon = r.ret >= 0 ? '🟢' : '🔴';
    const sign = r.ret >= 0 ? '+' : '';
    msg += `${icon} <b>${r.t}</b>  ${sign}${r.ret.toFixed(2)}%\n`;
    msg += `   평단 $${formatMoney(r.avg)} → $${formatMoney(r.cur)} | ${r.qty}주\n`;
    msg += `   평가 $${formatMoney(r.evalAmt)} / 손익 $${formatMoney(r.pnl)}\n`;
  }

  msg += `\n⏰ ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  return msg;
}

function isPortCommand(text) {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  return (
    t === '/port' ||
    t === '/portfolio' ||
    t === '/status' ||
    t === '포트' ||
    t === '포트폴리오' ||
    t === '잔고' ||
    t.startsWith('/port@') ||
    t.startsWith('/status@')
  );
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const body = req.body || {};
    const callback = body.callback_query;
    const message = body.message;

    // ===== 텍스트 명령: /port 등 =====
    if (message && message.text && isPortCommand(message.text)) {
      const msg = await buildPortfolioMessage();
      await sendMessage(msg);
      return res.status(200).json({ ok: true, handled: 'port' });
    }

    // ===== 버튼 콜백 =====
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
