// src/activity의 순수 로직을 점검한다. 사용: node scripts/check-logic.mjs
// 별도 테스트 도구 없이 vite가 쓰는 rolldown으로 묶어서 node로 실행한다.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { rolldown } from "rolldown";

const out = mkdtempSync(join(tmpdir(), "garite-logic-"));
try {
  const bundle = await rolldown({ input: new URL("./logic.test.ts", import.meta.url).pathname, logLevel: "warn" });
  await bundle.write({ file: join(out, "logic.mjs"), format: "esm" });
  const run = spawnSync(process.execPath, [join(out, "logic.mjs")], { stdio: "inherit" });
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
