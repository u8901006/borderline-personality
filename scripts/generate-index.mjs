import { readdir, writeFile, readFile } from "node:fs/promises";

async function main() {
  const docsDir = "docs";
  let files = [];
  try {
    const all = await readdir(docsDir);
    files = all
      .filter((f) => f.startsWith("bpd-") && f.endsWith(".html") && f !== "index.html")
      .sort()
      .reverse();
  } catch {
    // no docs yet
  }

  const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
  let links = "";
  for (const f of files.slice(0, 60)) {
    const dateStr = f.replace("bpd-", "").replace(".html", "");
    let dateDisplay = dateStr;
    let weekday = "";
    try {
      const d = new Date(dateStr);
      dateDisplay = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
      weekday = weekdays[d.getDay()];
    } catch {
      // keep raw
    }
    links += `        <li><a href="${f}">📅 ${dateDisplay}（週${weekday}）</a></li>\n`;
  }

  const total = files.length;

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>BPD Research Daily &middot; 邊緣型人格障礙研究文獻日報</title>
<style>
  :root { --bg: #f6f1e8; --surface: #fffaf2; --line: #d8c5ab; --text: #2b2118; --muted: #766453; --accent: #8c4f2b; --accent-soft: #ead2bf; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: radial-gradient(circle at top, #fff6ea 0, var(--bg) 55%, #ead8c6 100%); color: var(--text); font-family: "Noto Sans TC", "PingFang TC", "Helvetica Neue", Arial, sans-serif; min-height: 100vh; }
  .container { position: relative; z-index: 1; max-width: 640px; margin: 0 auto; padding: 80px 24px; }
  .logo { font-size: 48px; text-align: center; margin-bottom: 16px; }
  h1 { text-align: center; font-size: 24px; color: var(--text); margin-bottom: 8px; }
  .subtitle { text-align: center; color: var(--accent); font-size: 14px; margin-bottom: 48px; }
  .count { text-align: center; color: var(--muted); font-size: 13px; margin-bottom: 32px; }
  ul { list-style: none; }
  li { margin-bottom: 8px; }
  a { color: var(--text); text-decoration: none; display: block; padding: 14px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; transition: all 0.2s; font-size: 15px; }
  a:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateX(4px); }
  .links-section { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--line); }
  .link-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .link-row a { display: inline-block; padding: 10px 18px; font-size: 13px; border-radius: 10px; }
  footer { margin-top: 40px; text-align: center; font-size: 12px; color: var(--muted); }
  footer a { display: inline; padding: 0; background: none; border: none; color: var(--muted); }
  footer a:hover { color: var(--accent); }
</style>
</head>
<body>
<div class="container">
  <div class="logo">🧠</div>
  <h1>BPD Research Daily</h1>
  <p class="subtitle">邊緣型人格障礙研究文獻日報 &middot; 每日自動更新</p>
  <p class="count">共 ${total} 期日報</p>
  <ul>
${links}  </ul>
  <div class="links-section">
    <div class="link-row">
      <a href="https://www.leepsyclinic.com/" target="_blank">🏥 李政洋身心診所</a>
      <a href="https://blog.leepsyclinic.com/" target="_blank">📬 訂閱電子報</a>
      <a href="https://buymeacoffee.com/CYlee" target="_blank">☕ Buy Me a Coffee</a>
    </div>
  </div>
  <footer>
    <p>Powered by PubMed + Zhipu AI &middot; <a href="https://github.com/u8901006/borderline-personality">GitHub</a></p>
  </footer>
</div>
</body>
</html>`;

  await writeFile(`${docsDir}/index.html`, html, "utf-8");
  console.error("[INFO] Index page generated");
}

main().catch((e) => {
  console.error(`[FATAL] ${e.message}`);
  process.exit(1);
});
