/**
 * 잔고 스냅샷 비교 → 입금/출금/보유 변화 감지
 */

const { loadState, saveState } = require('./store');

function snapshotFromBalance(balanceResult) {
  const positions = balanceResult.positions || {};
  const pos = {};
  for (const [t, p] of Object.entries(positions)) {
    pos[t] = {
      qty: p.qty || 0,
      avgPrice: p.avgPrice || 0
    };
  }
  return {
    at: new Date().toISOString(),
    positions: pos,
    // 한투 응답에 현금 필드가 있으면 여기에 확장
    cashHint: balanceResult.raw?.output2?.[0] || null
  };
}

function diffSnapshots(prev, next) {
  const changes = [];
  if (!prev || !prev.positions) {
    return { isFirst: true, changes: [] };
  }

  const prevPos = prev.positions || {};
  const nextPos = next.positions || {};
  const tickers = new Set([...Object.keys(prevPos), ...Object.keys(nextPos)]);

  for (const t of tickers) {
    const a = prevPos[t]?.qty || 0;
    const b = nextPos[t]?.qty || 0;
    if (a === b) continue;

    if (a === 0 && b > 0) {
      changes.push({ type: 'buy', ticker: t, from: a, to: b, msg: `${t} 신규 보유 ${b}주` });
    } else if (a > 0 && b === 0) {
      changes.push({ type: 'sell', ticker: t, from: a, to: b, msg: `${t} 전량 매도 (기존 ${a}주)` });
    } else if (b > a) {
      changes.push({ type: 'buy', ticker: t, from: a, to: b, msg: `${t} 수량 증가 ${a} → ${b}주` });
    } else {
      changes.push({ type: 'sell', ticker: t, from: a, to: b, msg: `${t} 수량 감소 ${a} → ${b}주` });
    }
  }

  return { isFirst: false, changes };
}

function formatBalanceChangeMessage(diff) {
  if (diff.isFirst) {
    return (
      `📸 <b>잔고 스냅샷 시작</b>\n\n` +
      `앞으로 보유 수량 변화를 감지해 알립니다.\n` +
      `(입금·출금 상세는 한투 현금 필드 연동 시 보강)`
    );
  }
  if (!diff.changes.length) return null;

  let msg = `🔔 <b>잔고 변화 감지</b>\n\n`;
  for (const c of diff.changes) {
    const icon = c.type === 'buy' ? '🟢' : '🔴';
    msg += `${icon} ${c.msg}\n`;
  }
  msg += `\n※ 한투 실제 체결 기준과 다를 수 있으니 앱에서 한 번 확인해 주세요.`;
  return msg;
}

/**
 * 스냅샷 저장 + 변화 메시지 반환 (없으면 null)
 */
async function checkAndUpdateBalance(balanceResult) {
  const state = await loadState();
  const prev = state.balanceSnapshot || null;
  const next = snapshotFromBalance(balanceResult);

  const diff = diffSnapshots(prev, next);

  state.balanceSnapshot = next;
  await saveState(state);

  return formatBalanceChangeMessage(diff);
}

module.exports = {
  checkAndUpdateBalance,
  snapshotFromBalance,
  diffSnapshots
};
