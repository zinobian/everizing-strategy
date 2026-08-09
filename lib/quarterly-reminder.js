/**
 * 분기 1회: 3배 추적 목록 · 시총 · 신규 · 퇴출 점검 알림
 * 1월 · 4월 · 7월 · 10월 1일 (KST) 근처
 */

function getKstParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // en-CA → YYYY-MM-DD
  const s = fmt.format(now);
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m, day: d };
}

/** 분기 첫 달 1일인지 */
function shouldRemindQuarterly(now = new Date()) {
  const { month, day } = getKstParts(now);
  const quarterMonths = [1, 4, 7, 10];
  return quarterMonths.includes(month) && day === 1;
}

function quarterlyReminderMessage(year, month) {
  const q = { 1: '1분기', 4: '2분기', 7: '3분기', 10: '4분기' }[month] || '분기';
  return (
    `📅 <b>분기 점검 알림 (${q})</b>\n\n` +
    `3배 레버리지 추적 목록을 검토할 시기입니다.\n\n` +
    `확인 항목:\n` +
    `1. 시총(AUM) 상위 · 증감\n` +
    `2. 신규 3배 레버리지 ETF\n` +
    `3. 퇴출·제외 후보\n\n` +
    `증권사 앱에서 시총 확인 후\n` +
    `Grok에게 「분기 점검」이라고 요청해 주세요.\n\n` +
    `※ 매일 수익률·거래량 순위는 봇이 자동 유지합니다.`
  );
}

module.exports = {
  shouldRemindQuarterly,
  quarterlyReminderMessage,
  getKstParts
};
