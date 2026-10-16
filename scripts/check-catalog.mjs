// src/config/{items,levels,slots}.json 이 마이그레이션 0004의 서버 카탈로그와 같은지 확인한다.
// 사용: node scripts/check-catalog.mjs
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const sql = read("supabase/migrations/0004_economy.sql");
const json = (n) => JSON.parse(read(`src/config/${n}.json`));

const block = (table) => {
  const m = sql.match(new RegExp(`insert into public\\.${table}[^;]*?values([^;]*);`, "s"));
  if (!m) throw new Error(`${table} insert를 찾지 못함`);
  return [...m[1].matchAll(/\(([^)]*)\)/g)].map((r) => r[1].split(",").map((v) => v.trim().replace(/^'|'$/g, "")));
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
