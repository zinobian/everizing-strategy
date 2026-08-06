/**
 * 에버라이징 일일 신호 (고급 알림 버전)
 */

const https = require('https');
const { getPrices } = require('../lib/price');
const { buildPortfolioStatus, summarize, isProfitTarget } = require('../lib/portfolio');
const CONFIG = require('../lib/config');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8808573863:AAGaoZo_1PbW53UObChFlreOUTeOA1nV1WM';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1004325585686';

function sendTelegram(message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function formatMoney(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // 테스트용 가상 포지션 (나중에 실제 잔고로 교체)
    const positions = {
      TQQQ: { qty: 20, avgPrice: 60.0 },
      SOXL: { qty: 10, avgPrice: 110.0 },
      GDXU: { qty: 15, avgPrice: 100.0 },
      DFEN: { qty: 8,  avgPrice: 80.0 }
    };

    const tickers = Object.keys(positions);
    const prices = await getPrices(tickers);
    const portfolio = buildPortfolioStatus(positions, prices);
    const summary = summarize(portfolio);

    const profitSignals = portfolio.filter(p =>
      isProfitTarget(p.returnPct, CONFIG.rules.profitNormal)
    );

    const now = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    // ===== 고급 메시지 구성 =====
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

    // 종목별 현황
    msg += `📋 <b>Positions</b>\n`;
    for (const p of portfolio) {
      const sign = p.returnPct >= 0 ? '+' : '';
      const icon = p.returnPct >= 15 ? '🔥' : (p.returnPct >= 0 ? '🟢' : '🔴');
      msg += `${icon} <b>${p.ticker}</b>  ${sign}${p.returnPct}%\n`;
      msg += `    $${formatMoney(p.avgPrice)} → $${formatMoney(p.currentPrice)}  |  ${p.qty}주\n`;
    }

    msg += `\n`;

    // 신호
    if (profitSignals.length > 0) {
      msg += `🚨 <b>ACTION REQUIRED</b>\n`;
      msg += `규칙1 익절 구간 도달 (+15%)\n\n`;
      for (const s of profitSignals) {
        msg += `✅ <b>${s.ticker}</b>  +${s.returnPct}%\n`;
        msg += `    평단 $${formatMoney(s.avgPrice)} → 현재 $${formatMoney(s.currentPrice)}\n`;
      }
      msg += `\n💡 익절 여부를 검토해 주세요.`;
    } else {
      msg += `✨ <b>No Exit Signal</b>\n`;
      msg += `현재 익절 조건에 해당하는 종목이 없습니다.`;
    }

    msg += `\n\n`;
    msg += `<i>※ 가상 포지션 기준 테스트</i>`;

    await sendTelegram(msg);

    return res.status(200).json({
      success: true,
      summary,
      profitSignals,
      message: '텔레그램 전송 완료'
    });

  } catch (error) {
    console.error('daily-signal 오류:', error.message);
    try {
      await sendTelegram(`❌ <b>Everizing Error</b>\n\n${error.message}`);
    } catch (e) {}

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
