// Vercel Serverless Function - KIS API 연동
const https = require('https');

// KIS API 호출 함수
async function callKisApi(path, method = 'GET', body = null) {
  const apiKey = process.env.KIS_API_KEY;
  const apiSecret = process.env.KIS_API_SECRET;
  const account = process.env.KIS_ACCOUNT;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openapi.koreainvestment.com:9443',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'appkey': apiKey,
        'appsecret': apiSecret,
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 주가 조회
async function getStockPrice(ticker) {
  const path = `/uapi/domestic-stock/v1/quotations/search-stock?q=${ticker}`;
  try {
    const result = await callKisApi(path);
    return result;
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error);
    return null;
  }
}

// 포트폴리오 조회
async function getPortfolio() {
  const account = process.env.KIS_ACCOUNT;
  const path = `/uapi/domestic-stock/v1/trading/inquire-balance?CANO=${account}&ACNT_PRDT_CD=01`;
  
  try {
    const result = await callKisApi(path);
    return result;
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return null;
  }
}

// 신호 생성 (간단한 버전)
function generateSignals(portfolio) {
  const signals = [];
  
  // 예시: TQQQ 익절 신호 (실제로는 더 복잡한 로직 필요)
  if (portfolio && portfolio.output1) {
    portfolio.output1.forEach(stock => {
      if (stock.prdt_name.includes('TQQQ')) {
        // 수익률 계산 (간단한 예시)
        const gainRate = parseFloat(stock.evlu_pfls_pct);
        if (gainRate >= 15) {
          signals.push({
            ticker: 'TQQQ',
            type: '익절',
            rate: gainRate,
            message: `TQQQ 익절 신호: 수익률 ${gainRate.toFixed(2)}%`
          });
        }
      }
    });
  }
  
  return signals;
}

// Vercel Serverless Handler
module.exports = async (req, res) => {
  try {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET') {
      // 포트폴리오 & 신호 조회
      const portfolio = await getPortfolio();
      const signals = generateSignals(portfolio);

      return res.status(200).json({
        ok: true,
        portfolio: portfolio,
        signals: signals,
        timestamp: new Date().toISOString()
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: error.message,
      ok: false 
    });
  }
};
