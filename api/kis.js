const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // 환경변수 확인
  console.log('KIS_API_KEY loaded:', process.env.KIS_API_KEY ? 'YES' : 'NO');
  console.log('KIS_API_SECRET loaded:', process.env.KIS_API_SECRET ? 'YES' : 'NO');
  console.log('KIS_ACCOUNT:', process.env.KIS_ACCOUNT);

  try {
    const token = process.env.KIS_API_KEY;
    const secret = process.env.KIS_API_SECRET;
    const account = process.env.KIS_ACCOUNT;

    if (!token || !secret || !account) {
      throw new Error('Missing KIS credentials');
    }

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
        'Authorization': `Bearer ${token}`,
        'appkey': token,
        'appsecret': secret,
        'tr_id': 'TTTC8434R'
      },
      rejectUnauthorized: false
    };

    console.log('Making KIS API request...');

    return new Promise((resolve, reject) => {
      const req_kis = https.request(options, (res_kis) => {
        let data = '';
        res_kis.on('data', chunk => data += chunk);
        res_kis.on('end', () => {
          console.log('KIS API Response received');
          try {
            const kisData = JSON.parse(data);
            console.log('KIS API Success:', kisData.rt_cd);

            if (kisData.rt_cd === '0') {
              // 성공
              const positions = (kisData.output2 || []).map(p => ({
                ticker: p.prdt_name,
                quantity: parseInt(p.hldg_qty),
                current_price: parseFloat(p.prpr),
                avg_price: parseFloat(p.pchs_avg_pricx),
                profit_rate: ((parseFloat(p.prpr) - parseFloat(p.pchs_avg_pricx)) / parseFloat(p.pchs_avg_pricx) * 100).toFixed(2)
              }));

              res.status(200).json({
                portfolio: {
                  total_value: positions.reduce((sum, p) => sum + (p.quantity * p.current_price), 0),
                  total_return: 1900000,
                  return_rate: 8.5,
                  positions
                },
                signals: [],
                exchange_rate: 1310.5
              });
            } else {
              throw new Error(`KIS API Error: ${kisData.msg}`);
            }
          } catch (e) {
            console.error('Parse error:', e.message);
            reject(e);
          }
        });
      });

      req_kis.on('error', (err) => {
        console.error('Request error:', err.message);
        reject(err);
      });

      req_kis.end();
    });

  } catch (error) {
    console.error('Final Error:', error.message);
    res.status(500).json({ 
      error: error.message,
      type: error.code
    });
  }
};
