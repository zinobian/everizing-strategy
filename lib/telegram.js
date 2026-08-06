/**
 * 텔레그램 전송 유틸
 */

const https = require('https');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8808573863:AAGaoZo_1PbW53UObChFlreOUTeOA1nV1WM';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1004325585686';

function request(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_TOKEN}${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
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

/**
 * 일반 메시지
 */
async function sendMessage(text) {
  return request('/sendMessage', {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  });
}

/**
 * 버튼 있는 메시지
 * buttons 예: [[{ text: '✅ 승인', callback_data: 'approve:TQQQ' }]]
 */
async function sendMessageWithButtons(text, buttons) {
  return request('/sendMessage', {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}

module.exports = {
  sendMessage,
  sendMessageWithButtons
};
