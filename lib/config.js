/**
 * 에버라이징 설정 (설명서 2026-08-01 기준)
 * 메인 7종목 일일 합계 140,000원
 * TECL = 캐쉬파킹 전용 (정액매수·매도규칙 없음)
 */

module.exports = {
  tickers: {
    TQQQ: { name: '나스닥100 3x', dailyBuy: 30000, excd: 'NAS' },
    SOXL: { name: '반도체 3x', dailyBuy: 30000, excd: 'AMS' },
    GDXU: { name: '금광 3x', dailyBuy: 30000, excd: 'AMS' },
    AGQ: { name: '은 2x', dailyBuy: 30000, excd: 'AMS' },
    DFEN: { name: '방산 3x', dailyBuy: 10000, excd: 'AMS' },
    UTSL: { name: '유틸리티 3x', dailyBuy: 10000, excd: 'AMS' },
    UBOT: { name: '로봇/AI 2x', dailyBuy: 10000, excd: 'AMS' }
    // TECL은 정액매수 대상 아님 → tickers에 넣지 않음 (캐쉬파킹 전용)
  },

  /** 캐쉬파킹 종목 */
  cashParkingTicker: 'TECL',

  rules: {
    profitNormal: 0.15, // 규칙1
    profitBoost: 0.25, // 규칙2
    breakConfirmDays: 10, // 규칙3
    reinvestDays: 15,
    hostedMinAge: 80,
    ma35: 35,
    ma240: 240,
    monthlyMa: 10
  },

  /**
   * 월 시드가 바뀌면 dailyBuy 총액만 비율 유지한 채 조정
   * 예: 월 300만 → 일 약 14만 (현재 기본)
   */
  scaleDailyBuys(totalDailyKrw) {
    const base = 140000;
    const factor = totalDailyKrw / base;
    const out = {};
    for (const [t, v] of Object.entries(this.tickers)) {
      out[t] = { ...v, dailyBuy: Math.round(v.dailyBuy * factor) };
    }
    return out;
  }
};
