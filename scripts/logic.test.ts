// 순수 로직(src/activity) 점검. scripts/check-logic.mjs가 묶어서 실행한다.
import { autoState, classify, shouldEndFocus } from "../src/activity/classify";
import { levelOf, nextLevelAt, MAX_LEVEL } from "../src/activity/level";
import { roomStageOf } from "../src/activity/roomLevel";
import { COINS_PER_UNIT, formatCoins, formatMinutes, formatUnits, kstDay, toUnits } from "../src/activity/units";
import { appKey, countsAsWork } from "../src/activity/workTime";

let failed = 0;
const eq = (a: unknown, b: unknown, m: string) => {
  if (a !== b) {
    failed++;
    console.log("FAIL", m, "→", a, "(기대:", b, ")");
  } else console.log("ok  ", m);
};

// 상태 판정
eq(autoState(0), "working", "입력 직후는 작업 중");
eq(autoState(119), "working", "119초는 작업 중");
eq(autoState(120), "idle", "120초는 쉬는 중");
eq(autoState(600), "idle", "600초는 쉬는 중");
eq(autoState(601), "away", "601초는 자리 비움");
eq(classify({ idleSeconds: 9999, focusMode: true, manualState: "away" }), "working", "집중 모드가 가장 우선");
eq(classify({ idleSeconds: 0, focusMode: false, manualState: "idle" }), "idle", "직접 고른 상태가 자동보다 우선");
eq(classify({ idleSeconds: 700, focusMode: false, manualState: null }), "away", "자동 판정");
eq(shouldEndFocus(1800), false, "집중 모드 30분 경계");
eq(shouldEndFocus(1801), true, "집중 모드 30분 초과면 해제");

// 작업 시간 인정
const progs = ["code", "clip studio paint"];
eq(appKey("Google Chrome"), "google chrome", "앱 키(mac)");
eq(appKey("Code.exe"), "code", "앱 키(win)");
eq(countsAsWork({ state: "working", appId: "YouTube", mode: "input", programs: [] }), true, "입력 모드는 아무 프로그램이나 인정");
eq(countsAsWork({ state: "idle", appId: "Code", mode: "input", programs: progs }), false, "쉬는 중은 인정 안 함");
eq(countsAsWork({ state: "working", appId: "Code.exe", mode: "programs", programs: progs }), true, "등록한 프로그램은 인정");
eq(countsAsWork({ state: "working", appId: "Safari", mode: "programs", programs: progs }), false, "등록 안 한 프로그램은 불인정");
eq(countsAsWork({ state: "working", appId: null, mode: "programs", programs: progs }), false, "프로그램을 모르면 불인정");
eq(countsAsWork({ state: "working", appId: "garite", mode: "programs", programs: progs }), null, "이 앱 자신은 중립");

// 레벨
eq(levelOf(0), 1, "0 → Lv.1");
eq(levelOf(99), 1, "99 → Lv.1");
eq(levelOf(100), 2, "100 → Lv.2");
eq(levelOf(1000), MAX_LEVEL, "1000 → 만렙");
eq(nextLevelAt(MAX_LEVEL), null, "만렙 다음은 없음");
eq(nextLevelAt(1), 100, "Lv.1 다음은 100");

// 방 단계
eq(roomStageOf(0).stage.name, "촛불", "방 0분");
eq(roomStageOf(59).stage.name, "촛불", "방 59분");
eq(roomStageOf(60).stage.name, "전구", "방 60분");
eq(roomStageOf(180).stage.name, "전등", "방 3시간");
eq(roomStageOf(360).stage.name, "샹들리에", "방 6시간");
eq(roomStageOf(600).stage.name, "별빛", "방 10시간");
eq(roomStageOf(700).next, null, "최고 단계 다음은 없음");
eq(roomStageOf(30).minutesToNext, 30, "다음 단계까지 30분");

// 단위·시간 표시
eq(COINS_PER_UNIT, 2, "코인/불씨 비율(서버 기본 적립 2와 같아야 함)");
eq(toUnits(91), 45, "코인 → 불씨는 내림");
eq(formatUnits(0), "0불씨", "0불씨");
eq(formatUnits(60), "1등불", "60불씨 = 1등불");
eq(formatUnits(75), "1등불 15불씨", "1등불 15불씨");
eq(formatCoins(120), "1등불", "혼자 1시간 = 120코인 = 1등불");
eq(formatMinutes(45), "45분", "45분");
eq(formatMinutes(120), "2시간", "2시간");
eq(formatMinutes(125), "2시간 5분", "2시간 5분");
eq(kstDay(Date.UTC(2026, 0, 1, 14, 59)), "2026-01-01", "한국 23:59는 같은 날");
eq(kstDay(Date.UTC(2026, 0, 1, 15, 0)), "2026-01-02", "한국 자정에 날짜가 바뀜");

if (failed) {
  console.log(`\n${failed}개 실패`);
  process.exit(1);
}
console.log("\n모두 통과");
