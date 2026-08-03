// Vercel Serverless Function - 텔레그램 알림
const https = require('https');

// 텔레그램 메시지 전송
async function sendTelegramMessage(message) {
const token = '8808573863:AAGaoZo_1PbW53U0bChF1reOUTeOA1nV1bM';
const chatId = '-5309587192';

  const data = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML'
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let result = '';
      res.on('data', chunk => result += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(result));
        } catch (e) {
          resolve({ ok: true });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 신호 알림 전송
async function sendSignalAlert(signal) {
  const message = `
🚨 <b>매매 신호 발생!</b>
<b>메시지:</b> ${signal.message || '신호'}
⏰ 시간: ${new Date().toLocaleString('ko-KR')}
`;

  return await sendTelegramMessage(message);
}

// 일일 현황 리포트
async function sendDailyReport(portfolio) {
  const message = `
📊 <b>일일 포트폴리오 리포트</b>

평가액: ${portfolio.total_value || 'N/A'}원
수익률: ${portfolio.total_return || 'N/A'}%

⏰ ${new Date().toLocaleString('ko-KR')}
`;

  return await sendTelegramMessage(message);
}

// Vercel Serverless Handler
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method === 'POST') {
      const { type, data } = req.body;

      if (type === 'signal') {
        const result = await sendSignalAlert(data);
        return res.status(200).json({ ok: true, result });
      } else if (type === 'report') {
        const result = await sendDailyReport(data);
        return res.status(200).json({ ok: true, result });
      }
    }

    res.status(400).json({ error: 'Invalid request' });
  } catch (error) {
    console.error('Telegram Error:', error);
    res.status(500).json({ error: error.message });
  }
};
