import { execSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ghpages from "gh-pages";

const ROOT = join(import.meta.dirname, "..");

function getRepoName() {
  const remote = execSync("git config --get remote.origin.url", { cwd: ROOT })
    .toString()
    .trim();
  const m = remote.match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (!m) throw new Error(`Không đọc được repo từ remote: ${remote}`);
  return m[2];
}

const repo = getRepoName();
const owner = execSync("git config --get remote.origin.url", { cwd: ROOT })
  .toString()
  .match(/github\.com[/:]([^/]+)\//)?.[1];

console.log(`Deploying to GitHub Pages: ${owner}/${repo}`);
console.log(`basePath = /${repo}`);

// Build bản export với basePath đúng cho GitHub Pages
const result = spawnSync("npm", ["run", "build"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_BASE_PATH: `/${repo}` },
});
if (result.status !== 0) {
  throw new Error("Build thất bại");
}

// Kiểm tra không có secret nào lọt vào bản deploy
let scanned = 0;
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else {
      scanned++;
      const s = readFileSync(p, "utf-8");
      if (/AIGW|sk-[a-zA-Z0-9]{8,}|netmind\.viettel\.vn/.test(s)) {
        throw new Error(`PHÁT HIỆN SECRET trong ${p} — hủy deploy!`);
      }
    }
  }
}
walk(join(ROOT, "out"));
console.log(`Secret scan OK (${scanned} files)`);

ghpages.publish(
  join(ROOT, "out"),
  {
    dotfiles: true,
    branch: "gh-pages",
    repo: `https://github.com/${owner}/${repo}.git`,
  },
  (err) => {
    if (err) {
      console.error("Publish failed:", err);
      process.exit(1);
    }
    console.log(`Published to gh-pages branch. Site: https://${owner}.github.io/${repo}/`);
  }
);
