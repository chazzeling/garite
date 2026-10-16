// 재화의 화면 단위: 등불. 1분 작업 = 불씨 1개, 불씨 60개 = 등불 1개 (혼자 1시간 작업하면 등불 하나).
// 서버·DB는 계속 "코인"으로 계산한다(혼자 작업하면 1분에 2코인, 함께 작업하면 최대 7코인) — 화면에 보일 때만 불씨로 바꾼다.
// 서버의 기본 적립량(log_minute의 2)을 바꾸면 COINS_PER_UNIT도 같이 바꿀 것.
export const COINS_PER_UNIT = 2;
export const UNITS_PER_BIG = 60;
export const UNIT_NAME = "불씨"; // 작은 단위
export const BIG_NAME = "등불"; // 큰 단위 (60불씨)

/** 코인 → 불씨 (내림: 함께 작업해서 생긴 반 개는 내부적으로만 남는다) */
export const toUnits = (coins: number): number => Math.floor(coins / COINS_PER_UNIT);

/** 불씨 수 → "45불씨" / "1등불" / "1등불 15불씨" */
export function formatUnits(units: number): string {
  const big = Math.floor(units / UNITS_PER_BIG);
  const rest = units % UNITS_PER_BIG;
  if (big === 0) return `${rest}${UNIT_NAME}`;
  return rest === 0 ? `${big}${BIG_NAME}` : `${big}${BIG_NAME} ${rest}${UNIT_NAME}`;
}

/** 코인 → 화면 문구 */
export const formatCoins = (coins: number): string => formatUnits(toUnits(coins));
