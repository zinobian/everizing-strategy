const https = require('https');

// 텔레그램 설정
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8808573863:AAGaoZo_1PbW53UObChFlreOUTeOA1nV1WM';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1004325585686';

// Access Token 발급
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
          if (json.access_token) {
            resolve(json.access_token);
          } else {
            reject(new Error('Token 발급 실패: ' + JSON.stringify(json)));
          }
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

// 잔고 조회
function getBalance(accessToken, appKey, appSecret, account) {
  return new Promise((resolve, reject) => {
    const cano = account.substring(0, 8);
    const acnt = account.substring(8);

    const path = `/uapi/domestic-stock/v1/trading/inquire-balance?CANO=${cano}&ACNT_PRDT_CD=${acnt}&AFHR_FLPR_YN=N&OFL_YN=&TR_CRCY_CODE=&INQR_DVSN=02&CASH_CRD_DVSN=00`;

    const options = {
      hostname: 'openapi.koreainvestment.com',
      port: 9443,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'appkey': appKey,
        'appsecret': appSecret,
        'tr_id': 'TTTC8434R'
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 텔레그램 메시지 전송
function sendTelegram(message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
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

// 메인 실행
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const appKey = process.env.KIS_API_KEY;
    const appSecret = process.env.KIS_API_SECRET;
    const account = process.env.KIS_ACCOUNT;

    if (!appKey || !appSecret || !account) {
      throw new Error('KIS 환경변수가 없습니다.');
    }

    // 1. 토큰 발급
    const accessToken = await getAccessToken(appKey, appSecret);

    // 2. 잔고 조회
    const balanceData = await getBalance(accessToken, appKey, appSecret, account);

    // 3. 메시지 작성
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    let message = '';

    if (balanceData.rt_cd === '0') {
      message = `📊 <b>에버라이징 일일 리포트</b>\n\n` +
                `⏰ ${now}\n\n` +
                `현재 계좌에 보유 종목이 없습니다.\n` +
                `잔고: 0원`;
    } else {
      message = `⚠️ 잔고 조회 실패\n\n에러: ${balanceData.msg1 || '알 수 없는 오류'}`;
    }

    // 4. 텔레그램 전송
    await sendTelegram(message);

    return res.status(200).json({
      success: true,
      message: '텔레그램 전송 완료'
    });

  } catch (error) {
    console.error('Error:', error.message);

    try {
      await sendTelegram(`❌ 일일 리포트 오류\n\n${error.message}`);
    } catch (e) {}

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
