/**
 * 에버라이징 스트레티지 - 기본 설정
 * 이 파일만 수정하면 종목/금액/규칙을 바꿀 수 있습니다.
 */

const CONFIG = {
  // ===== 대상 종목 & 일일 매수금액 =====
  tickers: {
    TQQQ: { name: '나스닥100 3배', dailyBuy: 30000, leverage: 3 },
    SOXL: { name: '반도체 3배',   dailyBuy: 30000, leverage: 3 },
    GDXU: { name: '금광 3배',     dailyBuy: 30000, leverage: 3 },
    AGQ:  { name: '은 2배',       dailyBuy: 30000, leverage: 2 },
    DFEN: { name: '방산 3배',     dailyBuy: 10000, leverage: 3 },
    UTSL: { name: '유틸리티 3배', dailyBuy: 10000, leverage: 3 },
    UBOT: { name: '로봇/AI 2배',  dailyBuy: 10000, leverage: 2 },
  },

  // 캐쉬파킹 (ATH 매도 잔여금 보관)
  parking: {
    ticker: 'TECL',
    name: '나스닥 기술 3배 (파킹)'
  },

  // ===== 매매 규칙 파라미터 =====
  rules: {
    // 규칙1: 기본 익절
    profitNormal: 0.15,      // +15%

    // 규칙2: 부스트 익절 (월봉10 위일 때)
    profitBoost: 0.25,       // +25%

    // 규칙3: 브레이크스탑 (손절)
    ma240: 240,              // 240일 이동평균
    breakConfirmDays: 10,    // 10일 연속 하회 시 손절

    // 규칙4: ATH 트레일링스탑
    ma35: 35,                // 35일 이동평균

    // 재투자
    reinvestDays: 15,        // 15거래일 분할 재투자

    // 대여랏
    hostedMinAge: 80,        // 80거래일 이후 정산 체크
  },

  // ===== 기타 =====
  currency: 'KRW',
  timezone: 'Asia/Seoul',
};

// 일일 총 매수금액 계산
CONFIG.totalDailyBuy = Object.values(CONFIG.tickers)
  .reduce((sum, t) => sum + t.dailyBuy, 0);

// 종목 리스트만 편하게 쓰도록
CONFIG.tickerList = Object.keys(CONFIG.tickers);

module.exports = CONFIG;
