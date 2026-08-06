const { sendMessageWithButtons } = require('../lib/telegram');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const result = await sendMessageWithButtons(
      '🧪 <b>버튼 테스트</b>\n\n아래 버튼이 보이면 성공입니다.',
      [
        [
          { text: '✅ 승인 테스트', callback_data: 'test_approve' },
          { text: '⏸ 보류 테스트', callback_data: 'test_hold' }
        ]
      ]
    );

    return res.status(200).json({
      success: true,
      telegram: result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
