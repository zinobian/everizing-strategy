/**
 * 종목별 무장 상태
 * - stopArmed: 규칙3 손절 가능 여부 (240 위 복귀 시 재무장)
 * - athArmed: 규칙4 가능 여부 (신고가 경신 시 무장)
 * - below240Days: 240일선 연속 하회 일수
 */

const { loadState, saveState } = require('./store');

function defaultArm() {
  return {
    stopArmed: true,
    athArmed: false,
    below240Days: 0,
    athPrice: null
  };
}

async function getArmState(ticker) {
  const state = await loadState();
  if (!state.arms) state.arms = {};
  if (!state.arms[ticker]) state.arms[ticker] = defaultArm();
  return { ...defaultArm(), ...state.arms[ticker] };
}

async function setArmState(ticker, patch) {
  const state = await loadState();
  if (!state.arms) state.arms = {};
  const prev = { ...defaultArm(), ...(state.arms[ticker] || {}) };
  state.arms[ticker] = { ...prev, ...patch };
  await saveState(state);
  return state.arms[ticker];
}

/**
 * 일봉 지표로 무장 갱신 (매도 판정 전 호출)
 * @param {string} ticker
 * @param {object} daily - getDailyIndicators 결과
 * @param {number} current - 현재가/종가
 */
async function updateArms(ticker, daily, current) {
  const arm = await getArmState(ticker);
  const ma240 = daily?.ma240;
  const ath = daily?.ath;
  let below240Days = arm.below240Days || 0;
  let stopArmed = arm.stopArmed !== false;
  let athArmed = !!arm.athArmed;
  let athPrice = arm.athPrice;

  // 240일선 위 → 손절 재무장 + 하회일수 리셋
  if (ma240 != null && current >= ma240) {
    stopArmed = true;
    below240Days = 0;
  } else if (ma240 != null && current < ma240) {
    below240Days = (arm.below240Days || 0) + 1;
  }

  // 신고가 경신 → 신고가 무장
  if (ath != null && current >= ath) {
    athArmed = true;
    athPrice = Math.max(athPrice || 0, current, ath);
  } else if (ath != null && current > (athPrice || 0)) {
    athArmed = true;
    athPrice = current;
  }

  const next = {
    stopArmed,
    athArmed,
    below240Days,
    athPrice: athPrice || ath || null
  };
  await setArmState(ticker, next);
  return next;
}

/** 규칙3 발동 후 손절 무장 해제 */
async function disarmStop(ticker) {
  return setArmState(ticker, { stopArmed: false, below240Days: 0 });
}

/** 규칙4 발동 후 신고가 무장 해제 */
async function disarmAth(ticker) {
  return setArmState(ticker, { athArmed: false });
}

module.exports = {
  getArmState,
  setArmState,
  updateArms,
  disarmStop,
  disarmAth,
  defaultArm
};
