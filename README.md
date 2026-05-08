# BPD Research Daily Report

邊緣型人格障礙（Borderline Personality Disorder）研究文獻日報，由 AI 自動彙整 PubMed、Semantic Scholar、OpenAlex 最新論文。

## 架構

- **資料來源**：PubMed E-utilities、Semantic Scholar API、OpenAlex API
- **AI 分析**：Zhipu GLM-5-Turbo（fallback: GLM-4.7 → GLM-4.7-Flash）
- **部署**：GitHub Pages
- **排程**：每日 21:00（台北時間）自動執行

## 開發

```bash
cd scripts && npm install
node scripts/fetch-papers.mjs --days 7 --max-papers 40 --output papers.json
ZHIPU_API_KEY=xxx node scripts/generate-report.mjs --input papers.json --output docs/bpd-test.html
```

## 授權

研究資料來自公開學術資料庫，僅供學術參考。
