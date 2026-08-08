/**
 * 15일 분할 재투자 안내 계산
 */

/**
 * @param {number} amountUsd - 매도대금 (USD)
 * @param {number} days - 분할 일수 (기본 15)
 * @param {Date} startDate - 시작일 (기본: 다음 영업일 근사)
 */
function buildReinvestPlan(amountUsd, days = 15, startDate = null) {
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

  // 시작일: 내일부터 (주말은 단순 표시, 실제 영업일은 사용자가 조정)
  const start = startDate ? new Date(startDate) : new Date();
  start.setDate(start.getDate() + 1);

  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');

    schedule.push({
      day: i + 1,
      date: `${yyyy}-${mm}-${dd}`,
      amount: Number(daily.toFixed(2))
    });
  }

  const end = schedule[schedule.length - 1]?.date || '';

  return {
    total: Number(total.toFixed(2)),
    days: n,
    daily: Number(daily.toFixed(2)),
    startDate: schedule[0]?.date || '',
    endDate: end,
    schedule,
    message: `총 $${Number(total.toFixed(2))} 를 ${n}일에 나눠 하루 약 $${Number(daily.toFixed(2))} 재투자`
  };
}

/**
 * 텔레그램용 짧은 안내 문구
 */
function formatReinvestMessage(ticker, plan) {
  if (!plan || plan.total <= 0) return '';

  let msg = `\n📦 <b>재투자 안내 (${ticker})</b>\n`;
  msg += `총액: <code>$${plan.total}</code>\n`;
  msg += `기간: ${plan.startDate} ~ ${plan.endDate} (${plan.days}일)\n`;
  msg += `1일 금액: <code>$${plan.daily}</code>\n`;
  msg += `<i>※ 주말/공휴일은 다음 거래일로 조정하세요.</i>`;
  return msg;
}

module.exports = {
  buildReinvestPlan,
  formatReinvestMessage
};
