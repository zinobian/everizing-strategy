/**
 * 에버라이징 스트레티지 - 기본 설정
 */

const CONFIG = {
  // ===== 대상 종목 & 일일 매수금액 ===
  tickers: {
  TQQQ: { name: '나스닥100 3배', dailyBuy: 30000, leverage: 3, excd: 'NAS' },
  SOXL: { name: '반도체 3배',   dailyBuy: 30000, leverage: 3, excd: 'AMS' },
  GDXU: { name: '금광 3배',     dailyBuy: 30000, leverage: 3, excd: 'NYS' },
  AGQ:  { name: '은 2배',       dailyBuy: 30000, leverage: 2, excd: 'AMS' },
  DFEN: { name: '방산 3배',     dailyBuy: 10000, leverage: 3, excd: 'NYS' },
  UTSL: { name: '유틸리티 3배', dailyBuy: 10000, leverage: 3, excd: 'AMS' },
  UBOT: { name: '로봇/AI 2배',  dailyBuy: 10000, leverage: 2, excd: 'AMS' },
},

  // 캐쉬파킹
  parking: {
    ticker: 'TECL',
    name: '나스닥 기술 3배 (파킹)',
    excd: 'NAS'
  },

  // ===== 매매 규칙 파라미터 =====
  rules: {
    profitNormal: 0.15,      // +15%
    profitBoost: 0.25,       // +25%
    ma240: 240,
    breakConfirmDays: 10,
    ma35: 35,
    reinvestDays: 15,
    hostedMinAge: 80,
  },

  currency: 'KRW',
  timezone: 'Asia/Seoul',
};

CONFIG.totalDailyBuy = Object.values(CONFIG.tickers)
  .reduce((sum, t) => sum + t.dailyBuy, 0);

CONFIG.tickerList = Object.keys(CONFIG.tickers);

module.exports = CONFIG;
