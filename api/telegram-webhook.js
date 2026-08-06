/**
 * 텔레그램 버튼 클릭 수신
 */

const { sendMessage } = require('../lib/telegram');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const body = req.body || {};
    const callback = body.callback_query;

    // 버튼 클릭이 아닌 일반 메시지면 무시
    if (!callback) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const data = callback.data || '';
    const from = callback.from?.first_name || 'User';
    const chatId = callback.message?.chat?.id;

    let reply = '';

    if (data.startsWith('approve:')) {
      const ticker = data.split(':')[1];
      reply = `✅ <b>${from}</b> 님이 <b>${ticker}</b> 익절을 승인했습니다.\n\n(현재는 기록만 합니다. 실제 주문 연동은 다음 단계)`;
    } else if (data === 'hold:all') {
      reply = `⏸ <b>${from}</b> 님이 전체 보류를 선택했습니다.`;
    } else if (data === 'test_approve') {
      reply = `✅ 승인 테스트 확인되었습니다.`;
    } else if (data === 'test_hold') {
      reply = `⏸ 보류 테스트 확인되었습니다.`;
    } else {
      reply = `알 수 없는 선택: <code>${data}</code>`;
    }

    // 결과 메시지 전송
    await sendMessage(reply);

    // 텔레그램에 "처리 완료" 응답 (로딩 표시 제거)
    // answerCallbackQuery는 별도 구현 가능

    return res.status(200).json({ ok: true, handled: data });
  } catch (error) {
    console.error('webhook error:', error.message);
    return res.status(200).json({ ok: false, error: error.message });
  }
};
