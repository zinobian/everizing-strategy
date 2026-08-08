/**
 * 미국 휴장일 목록 업데이트 리마인더
 * 매년 1월 1~7일, 하루 1회 안내
 */

function shouldRemindHolidayUpdate(now = new Date()) {
  // 한국 시간 기준
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const month = kst.getMonth() + 1; // 1~12
  const day = kst.getDate();
  return month === 1 && day >= 1 && day <= 7;
}

function holidayReminderMessage(year) {
  return (
    `📅 <b>연간 점검 알림</b>\n\n` +
    `${year}년 미국 증시 휴장일 목록을 확인·업데이트 해주세요.\n` +
    `파일: <code>lib/reinvest.js</code> → <code>US_MARKET_HOLIDAYS</code>\n\n` +
    `이 알림은 1월 1~7일에만 표시됩니다.`
  );
}

module.exports = {
  shouldRemindHolidayUpdate,
  holidayReminderMessage
};
