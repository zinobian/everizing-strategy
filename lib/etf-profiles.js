/**
 * 미국 레버리지 ETF 종목 카드
 * 상위 보유는 공시 기준 요약이며 수시 변경됨 (참고용)
 */

const PROFILES = {
  TQQQ: {
    name: 'ProShares UltraPro QQQ',
    leverage: '3배 롱',
    sector: '나스닥100 / 대형 기술',
    style: '미국 대형 성장·기술 중심. 변동성 매우 큼. 장기 보유 시 변동성 손실 주의.',
    topHoldings: ['엔비디아(NVDA)', '마이크로소프트(MSFT)', '애플(AAPL)', '아마존(AMZN)', '메타(META)', '브로드컴(AVGO)', '구글(GOOGL/GOOG)', '테슬라(TSLA)'],
  },
  SOXL: {
    name: 'Direxion Daily Semiconductor Bull 3X',
    leverage: '3배 롱',
    sector: '반도체',
    style: '반도체 설계·제조 집중. 사이클·AI 수요에 민감. 낙폭·반등 모두 큼.',
    topHoldings: ['엔비디아', '브로드컴', 'AMD', '퀄컴', '텍사스인스트루먼트', 'ASML', '마이크론', '인텔 등 반도체 바스켓'],
  },
  GDXU: {
    name: 'MicroSectors Gold Miners 3X Leveraged',
    leverage: '3배 롱',
    sector: '금광 주식',
    style: '금 가격·광산 원가에 연동. 금 ETF와 달리 광산 기업 리스크 포함. 변동성 극대.',
    topHoldings: ['뉴몬트', '바릭골드', '아그니코이글', '킨로스 등 금광 바스켓 (지수 추종)'],
  },
  AGQ: {
    name: 'ProShares Ultra Silver',
    leverage: '2배 롱',
    sector: '은(상품)',
    style: '은 선물 기반 2배. 산업·투자 수요, 달러·실질금리에 민감. 주식 포트폴리오 없음.',
    topHoldings: ['은 선물·스왑 등 상품 익스포저 (개별 주식 아님)'],
  },
  DFEN: {
    name: 'Direxion Daily Aerospace & Defense Bull 3X',
    leverage: '3배 롱',
    sector: '항공우주·방산',
    style: '방산·항공 수주·지정학 이슈에 민감. 상대적 방어 성격이어도 3배라 변동성 큼.',
    topHoldings: ['RTX', '록히드마틴', '보잉', '제너럴다이내믹스', '노스롭그루먼', 'L3해리스 등'],
  },
  UTSL: {
    name: 'Direxion Daily Utilities Bull 3X',
    leverage: '3배 롱',
    sector: '유틸리티',
    style: '전력·가스 등 규제 산업. 금리·배당 매력에 반응. 3배라 방어주라도 급등락 가능.',
    topHoldings: ['넥스트에라에너지', '서던컴퍼니', '듀크에너지', '아메리칸일렉트릭 등 유틸리티'],
  },
  UBOT: {
    name: 'Direxion Daily Robotics, AI & Automation Index Bull 2X',
    leverage: '2배 롱',
    sector: '로봇·AI·자동화',
    style: '로봇·산업자동화·AI 관련. 2배. 테마 순환에 따라 성과 기복.',
    topHoldings: ['엔비디아', '인튜이티브서지컬', '록웰오토메이션', 'ABB·키엔스 등 관련주 바스켓'],
  },
  TECL: {
    name: 'Direxion Daily Technology Bull 3X',
    leverage: '3배 롱',
    sector: '기술 (XLK 계열)',
    style: 'S&P 기술 섹터 3배. TQQQ와 겹치나 나스닥100과 구성 차이 있음.',
    topHoldings: ['MSFT', 'AAPL', 'NVDA', 'AVGO', 'CRM', 'AMD', 'ORCL 등 기술'],
  },
  SPXL: {
    name: 'Direxion Daily S&P 500 Bull 3X',
    leverage: '3배 롱',
    sector: 'S&P500 전체',
    style: '미국 대형주 시장 전체 3배. TQQQ보다 분산, 그래도 레버리지 리스크 동일.',
    topHoldings: ['S&P500 상위: AAPL, MSFT, NVDA, AMZN, META 등 시총 가중'],
  },
  UPRO: {
    name: 'ProShares UltraPro S&P 500',
    leverage: '3배 롱',
    sector: 'S&P500 전체',
    style: 'SPXL과 유사 (S&P500 3배). 발행사·추적 오차만 차이.',
    topHoldings: ['S&P500 시총 가중 바스켓'],
  },
  TNA: {
    name: 'Direxion Daily Small Cap Bull 3X',
    leverage: '3배 롱',
    sector: '러셀2000 소형주',
    style: '미국 소형주 3배. 경기·유동성에 민감. 대형주 레버리지보다 더 거칠 수 있음.',
    topHoldings: ['러셀2000 소형주 바스켓 (개별 초대형주 비중 낮음)'],
  },
  FAS: {
    name: 'Direxion Daily Financial Bull 3X',
    leverage: '3배 롱',
    sector: '금융',
    style: '은행·증권·보험 등. 금리·경기·규제에 민감.',
    topHoldings: ['버크셔', 'JP모건', '비자', '마스터카드', '뱅크오브아메리카 등 금융'],
  },
  LABU: {
    name: 'Direxion Daily S&P Biotech Bull 3X',
    leverage: '3배 롱',
    sector: '바이오테크',
    style: '바이오·신약. 임상·FDA 이슈로 급등락. 레버리지 중에서도 변동성 큰 편.',
    topHoldings: ['S&P 바이오테크 구성 중소형 바이오 바스켓'],
  },
  CURE: {
    name: 'Direxion Daily Healthcare Bull 3X',
    leverage: '3배 롱',
    sector: '헬스케어',
    style: '제약·의료기기·보험 등 헬스케어 섹터 3배. LABU보다 분산.',
    topHoldings: ['일라이릴리', '유나이티드헬스', 'J&J', '애브비', '머크 등'],
  },
  NAIL: {
    name: 'Direxion Daily Homebuilders & Supplies Bull 3X',
    leverage: '3배 롱',
    sector: '주택건설',
    style: '주택건설·관련 공급. 금리·주택 수요에 민감. 섹터 집중도 높음.',
    topHoldings: ['D.R.호튼', '렌나', 'PULTE', 'NVR 등 홈빌더'],
  },
  WEBL: {
    name: 'Direxion Daily Dow Jones Internet Bull 3X',
    leverage: '3배 롱',
    sector: '인터넷',
    style: '인터넷·온라인 플랫폼 3배. 성장주 성격, TQQQ와 일부 겹침.',
    topHoldings: ['아마존', '메타', '구글', '넷플릭스', '세일즈포스 등 인터넷'],
  },
  UDOW: {
    name: 'ProShares UltraPro Dow30',
    leverage: '3배 롱',
    sector: '다우30',
    style: '다우존스 산업평균 3배. 가격 가중. 나스닥 레버리지보다 구성 보수적 편.',
    topHoldings: ['유나이티드헬스', 'GS', 'MSFT', 'HD', 'SHW', 'CAT 등 다우30'],
  },
  YINN: {
    name: 'Direxion Daily FTSE China Bull 3X',
    leverage: '3배 롱',
    sector: '중국 대형주',
    style: '중국 본토·홍콩 관련 대형주 3배. 정책·지정학·환율 리스크 큼.',
    topHoldings: ['알리바바', '텐센트 관련', '중국 대형주 바스켓'],
  },
};

function formatProfile(ticker) {
  const t = String(ticker || '').toUpperCase();
  const p = PROFILES[t];
  if (!p) {
    return `❓ ${t}\n등록된 종목 카드가 없습니다.`;
  }
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

/** 텔레그램 인라인 버튼 3열 */
function buildEtfButtonRows(tickers) {
  const list = (tickers || Object.keys(PROFILES)).map((t) => String(t).toUpperCase());
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
  formatProfile,
  buildEtfButtonRows,
};
