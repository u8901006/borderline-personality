import { readFile, writeFile, readdir } from "node:fs/promises";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { input: "papers.json", output: "papers-dedup.json", docsDir: "docs" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) opts.input = args[++i];
    if (args[i] === "--output" && args[i + 1]) opts.output = args[++i];
    if (args[i] === "--docs-dir" && args[i + 1]) opts.docsDir = args[++i];
  }
  return opts;
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 100);
}

async function main() {
  const opts = parseArgs();

  let papersData;
  try {
    const raw = await readFile(opts.input, "utf-8");
    papersData = JSON.parse(raw);
  } catch {
    console.error("[WARN] Cannot read input, passing through empty");
    await writeFile(
      opts.output,
      JSON.stringify({ date: new Date().toISOString().split("T")[0], count: 0, papers: [] }),
      "utf-8"
    );
    return;
  }

  const alreadySummarized = new Set();
  try {
    const files = await readdir(opts.docsDir);
    const reportFiles = files.filter(
      (f) => f.startsWith("bpd-") && f.endsWith(".html")
    );
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    for (const f of reportFiles) {
      const dateStr = f.replace("bpd-", "").replace(".html", "");
      const fileDate = new Date(dateStr);
      if (fileDate >= sevenDaysAgo) {
        try {
          const html = await readFile(`${opts.docsDir}/${f}`, "utf-8");
          const titleMatches = html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g);
          for (const m of titleMatches) {
            const title = m[1].replace(/<[^>]+>/g, "").trim();
            if (title) alreadySummarized.add(normalizeTitle(title));
          }
        } catch {
          // skip unreadable files
        }
      }
    }
  } catch {
    // docs dir may not exist yet
  }

  console.error(
    `[INFO] Found ${alreadySummarized.size} already-summarized titles in last 7 days`
  );

  const filtered = (papersData.papers || []).filter((p) => {
    const key = normalizeTitle(p.title || "");
    return !alreadySummarized.has(key);
  });

  console.error(
    `[INFO] ${papersData.papers?.length || 0} total -> ${filtered.length} new papers after dedup`
  );

  const output = {
    date: papersData.date,
    count: filtered.length,
    papers: filtered,
  };

  await writeFile(opts.output, JSON.stringify(output, null, 2), "utf-8");
  console.error(`[INFO] Saved deduped data to ${opts.output}`);
}

main().catch((e) => {
  console.error(`[FATAL] ${e.message}`);
  process.exit(1);
});
