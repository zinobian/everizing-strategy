/**
 * 미국 주식 거래일 판정 (주말 + 주요 휴장)
 * KST 기준 "오늘"이 미국 세션 날짜로 거래일인지
 */

/** 연도별 미국 주요 휴장 (YYYY-MM-DD, 미국 날짜) — 매년 수동 보강 */
const US_HOLIDAYS = {
  2025: [
    '2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18',
    '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01',
    '2025-11-27', '2025-12-25'
  ],
  2026: [
    '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03',
    '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07',
    '2026-11-26', '2026-12-25'
  ]
};

/** 미국 동부 날짜 YYYY-MM-DD */
function getUsDateString(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

function getUsWeekday(now = new Date()) {
  // 0=일 ... 6=토 (en-US short)
  const w = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short'
  }).format(now);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[w] ?? -1;
}

function isUsHoliday(dateStr) {
  const year = Number(dateStr.slice(0, 4));
  const list = US_HOLIDAYS[year] || [];
  return list.includes(dateStr);
}

/** 미국 정규장 거래일 여부 */
function isUsTradingDay(now = new Date()) {
  const wd = getUsWeekday(now);
  if (wd === 0 || wd === 6) return false;
  const ds = getUsDateString(now);
  if (isUsHoliday(ds)) return false;
  return true;
}

module.exports = {
  isUsTradingDay,
  getUsDateString,
  isUsHoliday,
  US_HOLIDAYS
};
