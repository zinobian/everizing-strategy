/**
 * 15거래일 분할 재투자 안내
 * - 주말 제외
 * - 주요 미국 증시 휴장일 제외
 */

/** 미국 증시 주요 휴장일 (YYYY-MM-DD) - 필요 시 매년 보강 */
const US_MARKET_HOLIDAYS = new Set([
  // 2026
  '2026-01-01', // New Year
  '2026-01-19', // MLK
  '2026-02-16', // Presidents Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
  // 2027 (일부)
  '2027-01-01',
  '2027-01-18',
  '2027-02-15',
  '2027-03-26',
  '2027-05-31',
  '2027-06-18',
  '2027-07-05',
  '2027-09-06',
  '2027-11-25',
  '2027-12-24'
]);

function toYMD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isWeekend(d) {
  const day = d.getDay(); // 0 Sun, 6 Sat
  return day === 0 || day === 6;
}

function isUSHoliday(d) {
  return US_MARKET_HOLIDAYS.has(toYMD(d));
}

function isUSTradingDay(d) {
  return !isWeekend(d) && !isUSHoliday(d);
}

/** 다음 미국 거래일 */
function nextTradingDay(fromDate) {
  const d = new Date(fromDate);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (!isUSTradingDay(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * @param {number} amountUsd
 * @param {number} days 거래일 수 (기본 15)
 * @param {Date|null} fromDate 기준일 (기본 오늘) → 다음 거래일부터
 */
function buildReinvestPlan(amountUsd, days = 15, fromDate = null) {
  const total = Number(amountUsd) || 0;
  const n = days || 15;

  if (total <= 0) {
    return {
      total: 0,
      days: n,
      daily: 0,
      schedule: [],
      message: '재투자 금액이 없습니다.'
    };
  }

  const daily = total / n;
  const schedule = [];

  let cursor = fromDate ? new Date(fromDate) : new Date();
  cursor.setHours(12, 0, 0, 0);

  for (let i = 0; i < n; i++) {
    cursor = nextTradingDay(cursor);
    schedule.push({
      day: i + 1,
      date: toYMD(cursor),
      amount: Number(daily.toFixed(2))
    });
  }

  return {
    total: Number(total.toFixed(2)),
    days: n,
    daily: Number(daily.toFixed(2)),
    startDate: schedule[0]?.date || '',
    endDate: schedule[schedule.length - 1]?.date || '',
    schedule,
    message: `총 $${Number(total.toFixed(2))} 를 ${n}거래일에 나눠 하루 약 $${Number(daily.toFixed(2))} 재투자`
  };
}

function formatReinvestMessage(ticker, plan) {
  if (!plan || plan.total <= 0) return '';

  let msg = `\n📦 <b>재투자 안내 (${ticker})</b>\n`;
  msg += `총액: <code>$${plan.total}</code>\n`;
  msg += `기간: ${plan.startDate} ~ ${plan.endDate} (${plan.days}거래일)\n`;
  msg += `1일 금액: <code>$${plan.daily}</code>\n`;
  msg += `<i>※ 주말·미국 휴장일 제외</i>`;
  return msg;
}

module.exports = {
  buildReinvestPlan,
  formatReinvestMessage,
  isUSTradingDay,
  nextTradingDay
};
