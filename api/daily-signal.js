module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    // 신호 생성
    const signal = {
      ticker: 'TQQQ',
      type: '익절',
      rate: 15,
      message: '15% 수익률 목표 도달 - 익절 신호'
    };

    // Telegram 알림 전송
    const telegramRes = await fetch(
      `https://everizing-strategy.vercel.app/api/telegram`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'signal',
          data: {
            message: `🚨 ${signal.ticker} ${signal.type} 신호\n메시지: ${signal.message}`
          }
        })
      }
    );

    const telegramData = await telegramRes.json();
    res.status(200).json({ ok: true, signal, telegram: telegramData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
