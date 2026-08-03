const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  const token = '8808573863:AAGaoZo_1PbW53UObChFlreOUTeOA1nV1WM';
  const chatId = '-1004325585686';
  
  const message = '🚨 테스트 메시지 - 이게 보이나요?';
  
  const data = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML'
  });

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req_tg = https.request(options, (res_tg) => {
    let body = '';
    res_tg.on('data', chunk => body += chunk);
    res_tg.on('end', () => {
      res.status(200).json({ ok: true, telegram_response: body });
    });
  });

  req_tg.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });

  req_tg.write(data);
  req_tg.end();
};
