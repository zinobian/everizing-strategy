/**
 * 미국 레버리지 ETF 종목 카드
 * 하단 버튼은 3배 롱만 (2배 AGQ/UBOT 제외)
 */
const PROFILES = {
  TQQQ: {
    name: 'ProShares UltraPro QQQ',
    leverage: '3배 롱',
    sector: '나스닥100 / 대형 기술',
    style: '미국 대형 성장·기술. 변동성 매우 큼.',
    topHoldings: ['NVDA', 'MSFT', 'AAPL', 'AMZN', 'META', 'AVGO', 'GOOGL', 'TSLA'],
  },
  SOXL: {
    name: 'Direxion Daily Semiconductor Bull 3X',
    leverage: '3배 롱',
    sector: '반도체',
    style: '반도체 사이클·AI 수요. 낙폭·반등 모두 큼.',
    topHoldings: ['NVDA', 'AVGO', 'AMD', 'QCOM', 'TXN', 'ASML', 'MU'],
  },
  GDXU: {
    name: 'MicroSectors Gold Miners 3X',
    leverage: '3배 롱',
    sector: '금광 주식',
    style: '금 가격+광산 원가. 변동성 극대.',
    topHoldings: ['뉴몬트', '바릭골드', '아그니코이글 등'],
  },
  DFEN: {
    name: 'Direxion Daily Aerospace & Defense Bull 3X',
    leverage: '3배 롱',
    sector: '항공우주·방산',
    style: '방산 수주·지정학 이슈에 민감.',
    topHoldings: ['RTX', 'LMT', 'BA', 'GD', 'NOC'],
  },
  UTSL: {
    name: 'Direxion Daily Utilities Bull 3X',
    leverage: '3배 롱',
    sector: '유틸리티',
    style: '금리·규제 산업. 3배라 급등락 가능.',
    topHoldings: ['NEE', 'SO', 'DUK 등'],
  },
  TECL: {
    name: 'Direxion Daily Technology Bull 3X',
    leverage: '3배 롱',
    sector: '기술 (XLK)',
    style: 'S&P 기술 섹터 3배. TQQQ와 일부 겹침.',
    topHoldings: ['MSFT', 'AAPL', 'NVDA', 'AVGO', 'CRM'],
  },
  SPXL: {
    name: 'Direxion Daily S&P 500 Bull 3X',
    leverage: '3배 롱',
    sector: 'S&P500',
    style: '미국 대형주 시장 전체 3배.',
    topHoldings: ['S&P500 시총 가중'],
  },
  UPRO: {
    name: 'ProShares UltraPro S&P 500',
    leverage: '3배 롱',
    sector: 'S&P500',
    style: 'SPXL과 유사 (S&P500 3배).',
    topHoldings: ['S&P500 시총 가중'],
  },
  TNA: {
    name: 'Direxion Daily Small Cap Bull 3X',
    leverage: '3배 롱',
    sector: '러셀2000 소형주',
    style: '소형주 3배. 경기·유동성에 민감.',
    topHoldings: ['러셀2000 바스켓'],
  },
  FAS: {
    name: 'Direxion Daily Financial Bull 3X',
    leverage: '3배 롱',
    sector: '금융',
    style: '은행·증권·보험. 금리·경기에 민감.',
    topHoldings: ['BRK.B', 'JPM', 'V', 'MA', 'BAC'],
  },
  LABU: {
    name: 'Direxion Daily S&P Biotech Bull 3X',
    leverage: '3배 롱',
    sector: '바이오테크',
    style: '임상·FDA 이슈로 급등락.',
    topHoldings: ['S&P 바이오테크 바스켓'],
  },
  CURE: {
    name: 'Direxion Daily Healthcare Bull 3X',
    leverage: '3배 롱',
    sector: '헬스케어',
    style: '제약·의료기기. LABU보다 분산.',
    topHoldings: ['LLY', 'UNH', 'JNJ', 'ABBV', 'MRK'],
  },
  NAIL: {
    name: 'Direxion Daily Homebuilders & Supplies Bull 3X',
    leverage: '3배 롱',
    sector: '주택건설',
    style: '금리·주택 수요에 민감.',
    topHoldings: ['DHI', 'LEN', 'PHM', 'NVR'],
  },
  WEBL: {
    name: 'Direxion Daily Dow Jones Internet Bull 3X',
    leverage: '3배 롱',
    sector: '인터넷',
    style: '온라인 플랫폼 3배.',
    topHoldings: ['AMZN', 'META', 'GOOGL', 'NFLX'],
  },
  UDOW: {
    name: 'ProShares UltraPro Dow30',
    leverage: '3배 롱',
    sector: '다우30',
    style: '다우 산업평균 3배. 가격 가중.',
    topHoldings: ['다우30 구성'],
  },
  YINN: {
    name: 'Direxion Daily FTSE China Bull 3X',
    leverage: '3배 롱',
    sector: '중국 대형주',
    style: '정책·지정학·환율 리스크 큼.',
    topHoldings: ['알리바바', '텐센트 관련 등'],
  },
  EDC: {
    name: 'Direxion Daily Emerging Markets Bull 3X',
    leverage: '3배 롱',
    sector: '신흥국',
    style: '신흥국 주식 3배. 달러·원자재에 민감.',
    topHoldings: ['신흥국 대형주 바스켓'],
  },
  KORU: {
    name: 'Direxion Daily MSCI South Korea Bull 3X',
    leverage: '3배 롱',
    sector: '한국',
    style: '한국 대형주 3배. 반도체·수출 비중이 큼.',
    topHoldings: ['삼성전자', 'SK하이닉스 등'],
  },
  TMF: {
    name: 'Direxion Daily 20+ Year Treasury Bull 3X',
    leverage: '3배 롱',
    sector: '미국 장기채',
    style: '장기금리 하락 시 유리. 주식 3배와 성격이 다름.',
    topHoldings: ['미국 20년+ 국채'],
  },
  FNGU: {
    name: 'MicroSectors FANG+ 3X Leveraged ETN',
    leverage: '3배 롱',
    sector: 'FANG+',
    style: '대형 기술 소수 종목 집중 3배.',
    topHoldings: ['FANG+ 구성 (NVDA, META, AMZN 등)'],
  },
  BULZ: {
    name: 'MicroSectors FANG & Innovation 3X',
    leverage: '3배 롱',
    sector: 'FANG·혁신',
    style: '혁신·빅테크 집중. TQQQ/SOXL과 겹침.',
    topHoldings: ['NVDA', 'TSLA', 'AMD 등 혁신주'],
  },
  URTY: {
    name: 'ProShares UltraPro Russell2000',
    leverage: '3배 롱',
    sector: '러셀2000',
    style: 'TNA와 유사 (소형주 3배).',
    topHoldings: ['러셀2000 바스켓'],
  },
  RETL: {
    name: 'Direxion Daily Retail Bull 3X',
    leverage: '3배 롱',
    sector: '소매',
    style: '소비·소매 섹터 3배.',
    topHoldings: ['소매 관련주 바스켓'],
  },
  MIDU: {
    name: 'Direxion Daily Mid Cap Bull 3X',
    leverage: '3배 롱',
    sector: '중형주',
    style: 'S&P 중형주 3배.',
    topHoldings: ['S&P MidCap 바스켓'],
  },
  HIBL: {
    name: 'Direxion Daily S&P 500 High Beta Bull 3X',
    leverage: '3배 롱',
    sector: 'S&P 고베타',
    style: '고베타 대형주 3배. 변동성 큼.',
    topHoldings: ['S&P 고베타 바스켓'],
  },
  PILL: {
    name: 'Direxion Daily Pharmaceutical & Medical Bull 3X',
    leverage: '3배 롱',
    sector: '제약',
    style: '제약 섹터 3배.',
    topHoldings: ['제약 관련주 바스켓'],
  },
  DUSL: {
    name: 'Direxion Daily Industrials Bull 3X',
    leverage: '3배 롱',
    sector: '산업재',
    style: '산업재 섹터 3배.',
    topHoldings: ['산업재 바스켓'],
  },
  DPST: {
    name: 'Direxion Daily Regional Banks Bull 3X',
    leverage: '3배 롱',
    sector: '지역은행',
    style: '미국 지역은행 3배. 금리·신용 이슈에 민감.',
    topHoldings: ['미국 지역은행 바스켓'],
  },
};

const ALL_3X_TICKERS = [
  'TQQQ', 'SOXL', 'TECL', 'SPXL', 'UPRO',
  'FAS', 'TNA', 'URTY', 'UDOW',
  'LABU', 'CURE', 'PILL',
  'DFEN', 'UTSL', 'NAIL', 'WEBL',
  'GDXU', 'YINN', 'EDC', 'KORU',
  'FNGU', 'BULZ', 'HIBL',
  'RETL', 'MIDU', 'DUSL', 'DPST',
  'TMF',
];

function formatProfile(ticker) {
  const t = String(ticker || '').toUpperCase();
  const p = PROFILES[t];
  if (!p) return `❓ ${t}\n등록된 종목 카드가 없습니다.`;
  const holds = (p.topHoldings || []).map((h) => `  · ${h}`).join('\n');
  return [
    `📌 ${t} · ${p.name}`,
    ``,
    `레버리지: ${p.leverage}`,
    `섹터: ${p.sector}`,
    ``,
    `성향`,
    p.style,
    ``,
    `주요 익스포저 (참고·변동 가능)`,
    holds,
    ``,
    `※ 구성·비중은 발행사 리밸런싱으로 달라질 수 있습니다.`,
  ].join('\n');
}

function buildEtfButtonRows(tickers) {
  const list = (tickers || ALL_3X_TICKERS).map((t) => String(t).toUpperCase());
  const rows = [];
  for (let i = 0; i < list.length; i += 3) {
    rows.push(
      list.slice(i, i + 3).map((t) => ({
        text: t,
        callback_data: `etf:${t}`,
      }))
    );
  }
  return rows;
}

module.exports = {
  PROFILES,
  ALL_3X_TICKERS,
  formatProfile,
  buildEtfButtonRows,
};
