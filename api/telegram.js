const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  const token = '8808573863:AAGaoZo_1PbW53UObChFlreOUTeOA1nV1WM';
  const chatId = '-1004325585686';
  
  // 요청에서 보낸 메시지 받기
  const { type, data } = req.body;
  const message = data?.message || '테스트 메시지';
  
  const postData = JSON.stringify({
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
      'Content-Length': postData.length
    }
  };

  const telegramReq = https.request(options, (telegramRes) => {
    let body = '';
    telegramRes.on('data', chunk => body += chunk);
    telegramRes.on('end', () => {
      res.status(200).json({ ok: true, telegram_response: body });
    });
  });

  telegramReq.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });

  telegramReq.write(postData);
  telegramReq.end();
};
