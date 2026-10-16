// src/config/{items,levels,slots}.json 이 마이그레이션 0004의 서버 카탈로그와 같은지 확인한다.
// 사용: node scripts/check-catalog.mjs
import { readdirSync, readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
// 카탈로그 시드는 여러 마이그레이션(0004, 0009, …)에 나뉘어 있으므로 전부 합쳐서 본다
const sql = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => read(`supabase/migrations/${f}`))
  .join("\n");
const json = (n) => JSON.parse(read(`src/config/${n}.json`));

const block = (table) => {
  const inserts = [...sql.matchAll(new RegExp(`insert into public\\.${table}[^;]*?values([^;]*);`, "gs"))];
  if (inserts.length === 0) throw new Error(`${table} insert를 찾지 못함`);
  return inserts.flatMap((m) =>
    [...m[1].split(/on conflict/i)[0].matchAll(/\(([^)]*)\)/g)].map((r) => r[1].split(",").map((v) => v.trim().replace(/^'|'$/g, ""))),
  );
};

const serialize = (rows) => rows.map((r) => r.join("|")).sort().join("\n");
const pairs = [
  ["level_curve", json("levels").map((l) => [l.level, l.requiredTotal])],
  ["item_catalog", json("items").map((i) => [i.id, i.category, i.unlockLevel, i.cost])],
  ["slot_catalog", json("slots").map((s) => [s.id, s.category])],
];
let bad = 0;
for (const [table, rows] of pairs) {
  const same = serialize(block(table).map((r) => r.map(String))) === serialize(rows.map((r) => r.map(String)));
  console.log(`${same ? "OK  " : "DIFF"} ${table}`);
  if (!same) bad++;
}
process.exit(bad ? 1 : 0);
