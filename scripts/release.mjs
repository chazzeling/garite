// 새 버전 번호를 세 곳(package.json, tauri.conf.json, Cargo.toml)에 같이 적는다.
// 사용: node scripts/release.mjs 0.2.0
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("사용법: node scripts/release.mjs 0.2.0");
  process.exit(1);
}
const path = (p) => new URL(`../${p}`, import.meta.url);

for (const file of ["package.json", "src-tauri/tauri.conf.json"]) {
  const text = readFileSync(path(file), "utf8");
  writeFileSync(path(file), text.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));
}
const cargo = readFileSync(path("src-tauri/Cargo.toml"), "utf8");
writeFileSync(path("src-tauri/Cargo.toml"), cargo.replace(/^version = ".*"$/m, `version = "${version}"`));

console.log(`버전을 ${version}으로 바꿨어요. 이어서:`);
console.log(`  git add -A && git commit -m "v${version}" && git tag v${version} && git push && git push --tags`);
