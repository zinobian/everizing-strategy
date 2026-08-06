const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const appKey = process.env.KIS_API_KEY;
    const appSecret = process.env.KIS_API_SECRET;

    console.log('AppKey exists:', !!appKey);
    console.log('AppSecret exists:', !!appSecret);

    if (!appKey || !appSecret) {
      throw new Error('KIS_API_KEY 또는 KIS_API_SECRET이 없습니다.');
    }

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

    const result = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          console.log('Token API Status:', response.statusCode);
          console.log('Token API Raw Response:', data);
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(new Error('JSON 파싱 실패: ' + data));
          }
        });
      });

      request.on('error', (err) => {
        console.error('Network Error:', err.message);
        reject(err);
      });

      request.write(postData);
      request.end();
    });

    // 결과 확인
    if (result.access_token) {
      console.log('✅ Access Token 발급 성공');
      return res.status(200).json({
        success: true,
        access_token: result.access_token,
        token_type: result.token_type,
        expires_in: result.expires_in
      });
    } else {
      console.error('❌ Token 발급 실패:', result);
      return res.status(400).json({
        success: false,
        error: result
      });
    }

  } catch (error) {
    console.error('Final Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
