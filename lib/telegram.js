/**
 * 텔레그램 전송 — 환경변수만 사용, 토큰 trim
 */
const https = require('https');

function getToken() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN 없음');
  return String(t).trim();
}

function getChatId() {
  const id = process.env.TELEGRAM_CHAT_ID;
  if (!id) throw new Error('TELEGRAM_CHAT_ID 없음');
  const cleaned = String(id).trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : cleaned;
}

function request(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: 'api.telegram.org',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sendMessage(text) {
  const token = getToken();
  return request(`/bot${token}/sendMessage`, {
    chat_id: getChatId(),
    text: String(text),
    disable_web_page_preview: true,
  });
}

async function sendMessageWithButtons(text, buttons) {
  const token = getToken();
  return request(`/bot${token}/sendMessage`, {
    chat_id: getChatId(),
    text: String(text),
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: buttons },
  });
}

module.exports = {
  sendMessage,
  sendMessageWithButtons,
};
