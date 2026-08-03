module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // 테스트 데이터 반환 (실제 KIS API가 준비될 때까지)
    const mockData = {
      portfolio: {
        total_value: 12500000,
        total_return: 950000,
        return_rate: 8.5,
        positions: [
          { ticker: 'TQQQ', name: 'Invesco QQQ Trust', quantity: 50, current_price: 115.50, avg_price: 98.20, profit_rate: 17.7 },
          { ticker: 'SOXL', name: 'Direxion Daily Semiconductor', quantity: 30, current_price: 62.30, avg_price: 58.50, profit_rate: 6.5 },
          { ticker: 'GDXU', name: 'Direxion Daily Gold Miners', quantity: 25, current_price: 28.90, avg_price: 26.80, profit_rate: 7.8 }
        ]
      },
      signals: [
        { ticker: 'TQQQ', type: '익절', rate: 15, message: '15% 수익률 목표 도달' },
        { ticker: 'SOXL', type: '신고가', rate: 6.5, message: '신고가 경신' }
      ],
      exchange_rate: 1310.5
    };

    res.status(200).json(mockData);
  } catch (error) {
    console.error('KIS API Error:', error);
    res.status(500).json({ error: error.message });
  }
};
