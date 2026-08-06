const https = require('https');

// Access Token 발급 함수
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
            console.log('✅ Access Token 발급 성공');
            resolve(json.access_token);
          } else {
            console.error('Token 발급 실패 응답:', json);
            reject(new Error(`Token 발급 실패: ${JSON.stringify(json)}`));
          }
        } catch (e) {
          reject(new Error('Token 응답 파싱 실패: ' + data));
        }
      });
    });

    req.on('error', (err) => {
      console.error('Token 발급 네트워크 에러:', err.message);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  console.log('KIS_API_KEY loaded:', process.env.KIS_API_KEY ? 'YES' : 'NO');
  console.log('KIS_API_SECRET loaded:', process.env.KIS_API_SECRET ? 'YES' : 'NO');
  console.log('KIS_ACCOUNT:', process.env.KIS_ACCOUNT);

  try {
    const appKey = process.env.KIS_API_KEY;
    const appSecret = process.env.KIS_API_SECRET;
    const account = process.env.KIS_ACCOUNT;

    if (!appKey || !appSecret || !account) {
      throw new Error('Missing KIS credentials (KIS_API_KEY, KIS_API_SECRET, KIS_ACCOUNT)');
    }

    // 1. Access Token 발급
    const accessToken = await getAccessToken(appKey, appSecret);

    // 2. 계좌번호 분리
    const cano = account.substring(0, 8);
    const acnt = account.substring(8);

    // 3. 잔고 조회 경로
    const path = `/uapi/domestic-stock/v1/trading/inquire-balance?CANO=${cano}&ACNT_PRDT_CD=${acnt}&AFHR_FLPR_YN=N&OFL_YN=&TR_CRCY_CODE=&INQR_DVSN=02&CASH_CRD_DVSN=00`;

    const options = {
      hostname: 'openapi.koreainvestment.com',
      port: 9443,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,  // ← 발급받은 토큰 사용
        'appkey': appKey,
        'appsecret': appSecret,
        'tr_id': 'TTTC8434R'
      },
      rejectUnauthorized: false
    };

    console.log('Making KIS Balance API request...');

    // 4. 잔고 조회 요청
    const kisData = await new Promise((resolve, reject) => {
      const req_kis = https.request(options, (res_kis) => {
        let data = '';
        res_kis.on('data', chunk => data += chunk);
        res_kis.on('end', () => {
          console.log('KIS API Response received');
          console.log('Raw Response:', data);

          try {
            const json = JSON.parse(data);
            console.log('rt_cd:', json.rt_cd);
            console.log('msg1:', json.msg1);
            resolve(json);
          } catch (e) {
            reject(new Error('잔고 조회 응답 파싱 실패: ' + data));
          }
        });
      });

      req_kis.on('error', (err) => {
        console.error('Network error:', err.message);
        reject(err);
      });

      req_kis.end();
    });

    // 5. 결과 처리
    if (kisData.rt_cd === '0') {
      const positions = (kisData.output2 || []).map(p => ({
        ticker: p.prdt_name || p.pdno,
        quantity: parseInt(p.hldg_qty || 0),
        current_price: parseFloat(p.prpr || 0),
        avg_price: parseFloat(p.pchs_avg_pric || 0),
        eval_amount: parseFloat(p.evlu_amt || 0),
        profit_loss: parseFloat(p.evlu_pfls_amt || 0)
      }));

      const totalValue = positions.reduce((sum, p) => sum + (p.eval_amount || 0), 0);

      return res.status(200).json({
        success: true,
        portfolio: {
          total_value: totalValue,
          positions
        },
        raw: kisData
      });
    } else {
      throw new Error(`KIS Error Code ${kisData.rt_cd}: ${kisData.msg1 || kisData.msg || 'No message provided'}`);
    }

  } catch (error) {
    console.error('❌ Final Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
