/**
 * 에버라이징 일일 신호
 * 무장 갱신 → 규칙3 → 1/2 → 4 판정
 */

const { getRealPositions } = require('../lib/balance');
const { getDailyIndicators } = require('../lib/daily');
const { evaluateAll } = require('../lib/rules');
const { sendMessage, sendMessageWithButtons } = require('../lib/telegram');
const { shouldRemindHolidayUpdate, holidayReminderMessage } = require('../lib/holiday-reminder');
const { shouldRemindQuarterly, quarterlyReminderMessage, getKstParts } = require('../lib/quarterly-reminder');
const { getUsdKrwRate } = require('../lib/fx');
const { ensureFirstBuyDate, getHoldingDays, getTradeCounts } = require('../lib/store');
const { getWatchQuotes, formatWatchBlock } = require('../lib/market-watch');
const { checkAndUpdateBalance } = require('../lib/balance-watch');
const { getAccessToken } = require('../lib/kis-token');
const { updateArms } = require('../lib/arming');
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

function formatKrw(n) {
  return Number(n).toLocaleString('ko-KR');
}

function fxBlock(fx) {
  if (!fx || !fx.ok || !fx.rate) {
    return `💱 <b>환율</b>\n조회 실패${fx?.message ? ` (${fx.message})` : ''}\n\n`;
  }
  const sign = fx.change > 0 ? '+' : '';
  return (
    `💱 <b>환율 USD/KRW</b>\n` +
    `오늘 <code>${formatFx(fx.rate)}</code>` +
    (fx.prev ? `  (전일 ${formatFx(fx.prev)})` : '') +
    (fx.change != null ? `\n변동 ${sign}${formatFx(fx.change)}` : '') +
    (fx.changePct != null ? ` (${sign}${fx.changePct}%)` : '') +
    `\n\n`
  );
}

function dcaBlock() {
  const tickers = CONFIG.tickers || {};
  const keys = Object.keys(tickers);
  if (keys.length === 0) return '';
  let total = 0;
  let lines = `💵 <b>정액매수 (일일)</b>\n`;
  for (const t of keys) {
    const amt = tickers[t].dailyBuy || 0;
    total += amt;
    lines += `├ ${t}  <code>${formatKrw(amt)}원</code>\n`;
  }
  lines += `└ 합계  <code>${formatKrw(total)}원</code>\n\n`;
  return lines;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const now = new Date();
    const nowText = now.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (shouldRemindHolidayUpdate(now)) {
      const year = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getFullYear();
      await sendMessage(holidayReminderMessage(year));
    }

    if (shouldRemindQuarterly(now)) {
      const { year, month } = getKstParts(now);
      await sendMessage(quarterlyReminderMessage(year, month));
    }

    const appKey = process.env.KIS_API_KEY;
    const appSecret = process.env.KIS_API_SECRET;
    const accessToken = await getAccessToken(appKey, appSecret);

    const fx = await getUsdKrwRate(accessToken);
    const fxRate = fx?.rate || 0;

    const balanceResult = await getRealPositions(accessToken);
    const positions = balanceResult.positions || {};

    try {
      const changeMsg = await checkAndUpdateBalance(balanceResult);
      if (changeMsg) await sendMessage(changeMsg);
    } catch (e) {
      console.error('balance-watch error:', e.message);
    }

    let watchQuotes = [];
    try {
      watchQuotes = await getWatchQuotes(accessToken, appKey, appSecret);
    } catch (e) {
      console.error('watch error:', e.message);
    }

    const header =
      `━━━━━━━━━━━━━━━━━━\n` +
      `📈 <b>EVERIZING DAILY REPORT</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `🗓 <b>${nowText}</b>\n\n` +
      fxBlock(fx);

    if (Object.keys(positions).length === 0) {
      let msg = header;
      msg += `💼 <b>Portfolio Summary</b>\n`;
      msg += `📭 보유 종목 없음\n`;
      msg += `매수 후 평가·신호가 여기에 표시됩니다.\n\n`;
      msg += dcaBlock();
      msg += formatWatchBlock(watchQuotes, fxRate);
      await sendMessage(msg);
      return res.status(200).json({ success: true, message: '보유 종목 없음', fx });
    }

    const today = now.toISOString().slice(0, 10);
    const tickers = Object.keys(positions);
    const dailies = {};
    const prices = {};
    const armMap = {};
    const holdingDaysMap = {};
    const tradeCountMap = {};

    for (const t of tickers) {
      await ensureFirstBuyDate(t, today);
      holdingDaysMap[t] = await getHoldingDays(t);
      tradeCountMap[t] = await getTradeCounts(t);

      const d = await getDailyIndicators(t, accessToken, appKey, appSecret);
      dailies[t] = d;
      const cur = d.lastClose || 0;
      prices[t] = { price: cur, prevClose: 0, change: 0 };

      // 무장 갱신 후 armMap에 저장
      armMap[t] = await updateArms(t, d, cur);

      await new Promise(r => setTimeout(r, 800));
    }

    const evaluations = evaluateAll(positions, prices, dailies, armMap);
    evaluations.sort((a, b) => (b.returnPct || 0) - (a.returnPct || 0));

    let totalCost = 0;
    let totalEval = 0;
    for (const e of evaluations) {
      totalCost += e.avgPrice * e.qty;
      totalEval += e.current * e.qty;
    }
    const totalPnl = totalEval - totalCost;
    const totalReturn = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    let msg = header;
    msg += `💼 <b>Portfolio Summary</b>\n`;
    msg += `├ 평가금액  <code>$${formatMoney(totalEval)}</code>\n`;
    msg += `├ 투자원금  <code>$${formatMoney(totalCost)}</code>\n`;
    msg += `├ 평가손익  <code>$${formatMoney(totalPnl)}</code>\n`;
    msg += `└ 수익률    <b>${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%</b>\n\n`;

    msg += `📋 <b>Positions (수익률순)</b>\n`;
    for (const e of evaluations) {
      const cost = e.avgPrice * e.qty;
      const evalAmt = e.current * e.qty;
      const pnl = evalAmt - cost;
      const sign = e.returnPct >= 0 ? '+' : '';
      const pnlSign = pnl >= 0 ? '+' : '';
      const icon = e.signals.length ? '🔥' : (e.returnPct >= 0 ? '🟢' : '🔴');
      const days = holdingDaysMap[e.ticker];
      const tc = tradeCountMap[e.ticker];
      const arm = e.arm || {};

      msg += `${icon} <b>${e.ticker}</b>  ${sign}${e.returnPct}%\n`;
      msg += `    평단 $${formatMoney(e.avgPrice)} → 현재 $${formatMoney(e.current)} | ${e.qty}주\n`;
      msg += `    평가 <code>$${formatMoney(evalAmt)}</code> / 원금 <code>$${formatMoney(cost)}</code>\n`;
      msg += `    손익 <code>${pnlSign}$${formatMoney(Math.abs(pnl))}</code>`;
      if (days != null) msg += ` · 투자 ${days}일`;
      if (tc && tc.total > 0) msg += ` · 매매 ${tc.total}회`;
      msg += `\n`;
      msg += `    무장 손절:${arm.stopArmed ? 'ON' : 'OFF'} ATH:${arm.athArmed ? 'ON' : 'OFF'}`;
      if (arm.below240Days) msg += ` · 240하회 ${arm.below240Days}일`;
      msg += `\n`;
    }
    msg += `\n`;

    // 같은 날 실무: primary(최우선 1개) 기준 승인 버튼
    const actionList = evaluations.filter(e => e.primary);

    if (actionList.length > 0) {
      msg += `🚨 <b>ACTION REQUIRED</b> (우선: 규칙3→1/2→4)\n`;
      for (const e of actionList) {
        const s = e.primary;
        msg += `• <b>${e.ticker}</b>: ${s.message}\n`;
      }
      msg += `\n`;
    } else {
      msg += `✨ <b>No Exit Signal</b>\n현재 조치할 신호가 없습니다.\n\n`;
    }

    msg += dcaBlock();
    msg += formatWatchBlock(watchQuotes, fxRate);

    if (actionList.length > 0) {
      const buttons = actionList.map(e => ([{
        text: `✅ ${e.ticker} 처리 승인`,
        callback_data: `approve:${e.ticker}`
      }]));
      buttons.push([{ text: '⏸ 전체 보류', callback_data: 'hold:all' }]);
      await sendMessageWithButtons(msg, buttons);
    } else {
      await sendMessage(msg);
    }

    return res.status(200).json({ success: true, fx, evaluations });
  } catch (error) {
    console.error('daily-signal 오류:', error.message);
    try { await sendMessage(`❌ <b>Everizing Error</b>\n\n${error.message}`); } catch (e) {}
    return res.status(500).json({ success: false, error: error.message });
  }
};
