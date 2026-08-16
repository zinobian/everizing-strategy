/**
 * 한투 봇 — 시세·순위·잔고 조회 전용 (에버라이징 매매 규칙 없음)
 */
module.exports = {
  // 미국 3배(일부 2배) 추적 리스트 — 순위용
  WATCH_LIST: [
    { ticker: 'TQQQ', name: '나스닥100 3배', excd: 'NAS' },
    { ticker: 'SOXL', name: '반도체 3배', excd: 'AMS' },
    { ticker: 'GDXU', name: '금광주 3배', excd: 'AMS' },
    { ticker: 'AGQ', name: '은 2배', excd: 'AMS' },
    { ticker: 'DFEN', name: '방산 3배', excd: 'AMS' },
    { ticker: 'UTSL', name: '유틸리티 3배', excd: 'AMS' },
    { ticker: 'UBOT', name: '로봇/AI 2배', excd: 'AMS' },
    { ticker: 'TECL', name: '기술 3배', excd: 'AMS' },
    { ticker: 'SPXL', name: 'S&P500 3배', excd: 'AMS' },
    { ticker: 'TNA', name: '러셀2000 3배', excd: 'AMS' },
    { ticker: 'FAS', name: '금융 3배', excd: 'AMS' },
    { ticker: 'LABU', name: '바이오 3배', excd: 'AMS' },
    { ticker: 'CURE', name: '헬스케어 3배', excd: 'AMS' },
    { ticker: 'NAIL', name: '주택건설 3배', excd: 'AMS' },
    { ticker: 'WEBL', name: '인터넷 3배', excd: 'AMS' },
    { ticker: 'UPRO', name: 'S&P500 3배', excd: 'AMS' },
    { ticker: 'UDOW', name: '다우 3배', excd: 'AMS' },
    { ticker: 'YINN', name: '중국 3배', excd: 'AMS' },
  ],

  // 순위 TOP N
  RANK_TOP: 10,

  // API 호출 간격 (ms) — rate limit 완화
  API_GAP_MS: 350,
};
