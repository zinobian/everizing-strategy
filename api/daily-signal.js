/**
 * 에버라이징 일일 신호 (규칙 엔진 연동)
 */

const https = require('https');
const { getRealPositions } = require('../lib/balance');
const { getDailyIndicators } = require('../lib/daily');
const { evaluateAll } = require('../lib/rules');
const { sendMessage, sendMessageWithButtons } = require('../lib/telegram');
const CONFIG = require('../lib/config');

function formatMoney(n) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getAccessToken(appKey, appSecret) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      grant_type: 'client_credentials',
      appkey: appKey,
      appsecret: appSecret
    });

    const options = {
      hostname: 'openapi.koreainvestment.com',
      port: 9443,
      path: '/oauth2/tokenP',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) resolve(json.access_token);
          else reject(new Error('Token 발급 실패: ' + JSON.stringify(json)));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
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

    // 1. 실제 잔고
    const balanceResult = await getRealPositions();
    const positions = balanceResult.positions || {};

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
      return res.status(200).json({ success: true, message: '보유 종목 없음' });
    }

    // 2. 토큰 1번
    const appKey = process.env.KIS_API_KEY;
    const appSecret = process.env.KIS_API_SECRET;
    const accessToken = await getAccessToken(appKey, appSecret);

    // 3. 일봉 지표 + 가격
    const tickers = Object.keys(positions);
    const dailies = {};
    const prices = {};

    for (const t of tickers) {
      const d = await getDailyIndicators(t, accessToken, appKey, appSecret);
      dailies[t] = d;
      prices[t] = { price: d.lastClose || 0, prevClose: 0, change: 0 };
      await new Promise(r => setTimeout(r, 800));
    }

    // 4. 규칙 평가
    const evaluations = evaluateAll(positions, prices, dailies);

    // 5. 요약
    let totalCost = 0;
    let totalEval = 0;
    for (const e of evaluations) {
      totalCost += e.avgPrice * e.qty;
      totalEval += e.current * e.qty;
    }
    const totalPnl = totalEval - totalCost;
    const totalReturn = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    // 6. 메시지
    let msg = '';
    msg += `━━━━━━━━━━━━━━━━━━\n`;
    msg += `📈 <b>EVERIZING DAILY REPORT</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `🗓 <b>${now}</b>\n\n`;
    msg += `💼 <b>Portfolio Summary</b>\n`;
    msg += `├ 평가금액  <code>$${formatMoney(totalEval)}</code>\n`;
    msg += `├ 투자원금  <code>$${formatMoney(totalCost)}</code>\n`;
    msg += `├ 평가손익  <code>$${formatMoney(totalPnl)}</code>\n`;
    msg += `└ 수익률    <b>${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%</b>\n\n`;

    msg += `📋 <b>Positions</b>\n`;
    for (const e of evaluations) {
      const sign = e.returnPct >= 0 ? '+' : '';
      const icon = e.signals.length ? '🔥' : (e.returnPct >= 0 ? '🟢' : '🔴');
      msg += `${icon} <b>${e.ticker}</b>  ${sign}${e.returnPct}%\n`;
      msg += `    $${formatMoney(e.avgPrice)} → $${formatMoney(e.current)}  |  ${e.qty}주\n`;
    }
    msg += `\n`;

    // 7. 신호 모으기
    const actionList = evaluations.filter(e => e.signals.length > 0);

    if (actionList.length > 0) {
      msg += `🚨 <b>ACTION REQUIRED</b>\n\n`;
      for (const e of actionList) {
        for (const s of e.signals) {
          msg += `• <b>${e.ticker}</b>: ${s.message}\n`;
        }
      }
      msg += `\n아래에서 선택해 주세요.`;

      const buttons = [];
      for (const e of actionList) {
        buttons.push([{
          text: `✅ ${e.ticker} 처리 승인`,
          callback_data: `approve:${e.ticker}`
        }]);
      }
      buttons.push([{ text: '⏸ 전체 보류', callback_data: 'hold:all' }]);

      await sendMessageWithButtons(msg, buttons);
    } else {
      msg += `✨ <b>No Exit Signal</b>\n현재 조치할 신호가 없습니다.`;
      await sendMessage(msg);
    }

    return res.status(200).json({
      success: true,
      evaluations,
      message: '전송 완료'
    });

  } catch (error) {
    console.error('daily-signal 오류:', error.message);
    try {
      await sendMessage(`❌ <b>Everizing Error</b>\n\n${error.message}`);
    } catch (e) {}
    return res.status(500).json({ success: false, error: error.message });
  }
};
