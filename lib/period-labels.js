/**
 * 일·주·월·연 기간 표시
 * 예: 26년 8월 15일 / 26년 8월 11일~15일
 */

function pad(n) {
  return n;
}

/**
 * @param {Date} d
 * @returns {string} 26년 8월 15일
 */
function ymdLabel(d) {
  const y = String(d.getFullYear()).slice(2);
  return `${y}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 같은 해·같은 달이면: 26년 8월 11일~15일
 * 월이 바뀌면: 26년 7월 28일~8월 3일
 * 해가 바뀌면: 25년 12월 30일~26년 1월 5일
 */
function rangeLabel(start, end) {
  const y1 = start.getFullYear();
  const y2 = end.getFullYear();
  const m1 = start.getMonth() + 1;
  const m2 = end.getMonth() + 1;
  const d1 = start.getDate();
  const d2 = end.getDate();
  const ys = String(y2).slice(2);

  if (y1 === y2 && m1 === m2) {
    return `${ys}년 ${m1}월 ${d1}일~${d2}일`;
  }
  if (y1 === y2) {
    return `${ys}년 ${m1}월 ${d1}일~${m2}월 ${d2}일`;
  }
  return `${String(y1).slice(2)}년 ${m1}월 ${d1}일~${ys}년 ${m2}월 ${d2}일`;
}

/**
 * asOf = 순위 계산에 쓴 마지막 거래일 (Date)
 * bars: 일봉 배열이 있으면 거래일 기준으로 주·월·연 시작일을 잡을 수 있음
 * 여기서는 캘린더 근사 (주=6일 전 포함 7일, 월=1개월, 연=1년)
 */
function periodLabels(asOf) {
  const end = new Date(asOf);
  end.setHours(12, 0, 0, 0);

  const weekStart = new Date(end);
  weekStart.setDate(weekStart.getDate() - 6);

  const monthStart = new Date(end);
  monthStart.setMonth(monthStart.getMonth() - 1);

  const yearStart = new Date(end);
  yearStart.setFullYear(yearStart.getFullYear() - 1);

  return {
    day: ymdLabel(end),
    week: rangeLabel(weekStart, end),
    month: rangeLabel(monthStart, end),
    year: rangeLabel(yearStart, end),
    // 계산용
    _end: end,
    _weekStart: weekStart,
    _monthStart: monthStart,
    _yearStart: yearStart,
  };
}

/** YYYYMMDD → Date */
function parseYmd(s) {
  if (!s || s.length < 8) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6)) - 1;
  const d = Number(s.slice(6, 8));
  return new Date(y, m, d, 12, 0, 0, 0);
}

module.exports = {
  ymdLabel,
  rangeLabel,
  periodLabels,
  parseYmd,
};
