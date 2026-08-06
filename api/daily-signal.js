/**
 * 에버라이징 일일 신호
 * - 실제 KIS 잔고 우선
 * - 잔고 없으면 안내 메시지
 */

const { getPrices } = require('../lib/price');
const { buildPortfolioStatus, summarize, isProfitTarget } = require('../lib/portfolio');
const { getRealPositions } = require('../lib/balance');
const { sendMessage, sendMessageWithButtons } = require('../lib/telegram');
const CONFIG = require('../lib/config');

function formatMoney(n) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const now = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    // 1. 실제 잔고 조회
    const balanceResult = await getRealPositions();
    let positions = balanceResult.positions || {};
    let usingMock = false;

    // 잔고 없으면 안내만 보내고 종료
    if (Object.keys(positions).length === 0) {
      const emptyMsg =
        `━━━━━━━━━━━━━━━━━━\n` +
        `📈 <b>EVERIZING DAILY REPORT</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `🗓 <b>${now}</b>\n\n` +
        `📭 <b>보유 종목 없음</b>\n` +
        `현재 계좌에 주식이 없습니다.\n` +
        `매수 후 자동으로 신호 분석이 시작됩니다.`;

      await sendMessage(emptyMsg);

      return res.status(200).json({
        success: true,
        message: '보유 종목 없음',
        positions: {}
      });
    }

    // 2. 시세 조회
    const tickers = Object.keys(positions);
    const prices = await getPrices(tickers);

    // 3. 포지션 상태 계산
    const portfolio = buildPortfolioStatus(positions, prices);
    const summary = summarize(portfolio);

    // 4. 익절 신호
    const profitSignals = portfolio.filter(p =>
      isProfitTarget(p.returnPct, CONFIG.rules.profitNormal)
    );

    // 5. 메시지
    let msg = '';
    msg += `━━━━━━━━━━━━━━━━━━\n`;
    msg += `📈 <b>EVERIZING DAILY REPORT</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `🗓 <b>${now}</b>\n\n`;

    msg += `💼 <b>Portfolio Summary</b>\n`;
    msg += `├ 평가금액  <code>$${formatMoney(summary.totalEval)}</code>\n`;
    msg += `├ 투자원금  <code>$${formatMoney(summary.totalCost)}</code>\n`;
    msg += `├ 평가손익  <code>$${formatMoney(summary.totalPnl)}</code>\n`;
    msg += `└ 수익률    <b>${summary.totalReturn >= 0 ? '+' : ''}${summary.totalReturn}%</b>\n\n`;

    msg += `📋 <b>Positions</b>\n`;
    for (const p of portfolio) {
      const sign = p.returnPct >= 0 ? '+' : '';
      const icon = p.returnPct >= 15 ? '🔥' : (p.returnPct >= 0 ? '🟢' : '🔴');
      msg += `${icon} <b>${p.ticker}</b>  ${sign}${p.returnPct}%\n`;
      msg += `    $${formatMoney(p.avgPrice)} → $${formatMoney(p.currentPrice)}  |  ${p.qty}주\n`;
    }
    msg += `\n`;

    if (profitSignals.length > 0) {
      msg += `🚨 <b>ACTION REQUIRED</b>\n`;
      msg += `규칙1 익절 구간 도달 (+15%)\n\n`;

      for (const s of profitSignals) {
        msg += `✅ <b>${s.ticker}</b>  +${s.returnPct}%\n`;
        msg += `    평단 $${formatMoney(s.avgPrice)} → 현재 $${formatMoney(s.currentPrice)}\n`;
      }
      msg += `\n아래에서 선택해 주세요.`;

      const buttons = profitSignals.map(s => ([
        { text: `✅ ${s.ticker} 익절 승인`, callback_data: `approve:${s.ticker}` }
      ]));
      buttons.push([{ text: '⏸ 전체 보류', callback_data: 'hold:all' }]);

      await sendMessageWithButtons(msg, buttons);
    } else {
      msg += `✨ <b>No Exit Signal</b>\n`;
      msg += `현재 익절 조건에 해당하는 종목이 없습니다.`;
      await sendMessage(msg);
    }

    return res.status(200).json({
      success: true,
      summary,
      profitSignals,
      usingMock,
      message: '전송 완료'
    });

  } catch (error) {
    console.error('daily-signal 오류:', error.message);
    try {
      await sendMessage(`❌ <b>Everizing Error</b>\n\n${error.message}`);
    } catch (e) {}

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
