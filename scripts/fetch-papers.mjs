import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const PUBMED_SEARCH =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_FETCH =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const SEMANTIC_SCHOLAR =
  "https://api.semanticscholar.org/graph/v1/paper/search";
const CROSSREF = "https://api.crossref.org/works";
const OPENALEX = "https://api.openalex.org/works";

const JOURNALS = [
  "Borderline Personality Disorder and Emotion Dysregulation",
  "Journal of Personality Disorders",
  "Personality Disorders: Theory, Research, and Treatment",
  "Personality and Mental Health",
  "Journal of Personality Assessment",
  "Assessment",
  "Psychological Assessment",
  "Personality and Individual Differences",
  "American Journal of Psychiatry",
  "JAMA Psychiatry",
  "The Lancet Psychiatry",
  "World Psychiatry",
  "British Journal of Psychiatry",
  "Psychological Medicine",
  "Acta Psychiatrica Scandinavica",
  "European Psychiatry",
  "Psychiatry Research",
  "Journal of Psychiatric Research",
  "Journal of Affective Disorders",
  "BMC Psychiatry",
  "Frontiers in Psychiatry",
  "Clinical Psychology Review",
  "Clinical Psychology & Psychotherapy",
  "Journal of Consulting and Clinical Psychology",
  "Behaviour Research and Therapy",
  "Behavior Therapy",
  "Psychotherapy Research",
  "Biological Psychiatry",
  "Molecular Psychiatry",
  "Translational Psychiatry",
  "Neuropsychopharmacology",
  "Psychoneuroendocrinology",
  "NeuroImage: Clinical",
  "Human Brain Mapping",
  "Social Cognitive and Affective Neuroscience",
  "Brain Behavior and Immunity",
  "Journal of the American Academy of Child & Adolescent Psychiatry",
  "Journal of Child Psychology and Psychiatry",
  "Development and Psychopathology",
  "European Child & Adolescent Psychiatry",
  "Suicide and Life-Threatening Behavior",
  "Archives of Suicide Research",
  "Crisis",
  "Addiction",
  "Drug and Alcohol Dependence",
  "Journal of Traumatic Stress",
  "European Journal of Psychotraumatology",
  "Child Abuse & Neglect",
  "Social Science & Medicine",
  "Social Psychiatry and Psychiatric Epidemiology",
  "Nutrients",
  "Nutritional Neuroscience",
  "Appetite",
  "International Journal of Eating Disorders",
  "Sports Medicine",
  "Mental Health and Physical Activity",
  "Sleep",
  "Sleep Medicine",
  "Behavioral Sleep Medicine",
];

const SEARCH_TOPICS = [
  '"borderline personality disorder"',
  '"borderline personality"',
  '"emotionally unstable personality disorder"',
  '"emotion dysregulation" AND "personality"',
  "BPD AND (\"personality disorder\" OR \"emotion dysregulation\")",
];

const HEADERS = {
  "User-Agent": "BPDDailyReportBot/1.0 (research aggregator; mailto:bpd-bot@example.com)",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { days: 7, maxPapers: 40, output: "papers.json" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) opts.days = parseInt(args[++i]);
    if (args[i] === "--max-papers" && args[i + 1])
      opts.maxPapers = parseInt(args[++i]);
    if (args[i] === "--output" && args[i + 1]) opts.output = args[++i];
  }
  return opts;
}

function getDateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0].replace(/-/g, "/");
}

async function fetchJSON(url, timeout = 30000) {
  const { request } = await import("undici");
  const resp = await request(url, {
    headers: HEADERS,
    headersTimeout: timeout,
    bodyTimeout: timeout,
  });
  if (resp.statusCode >= 400) {
    throw new Error(`HTTP ${resp.statusCode} from ${url}`);
  }
  return resp.body.json();
}

async function fetchXML(url, timeout = 60000) {
  const { request } = await import("undici");
  const resp = await request(url, {
    headers: HEADERS,
    headersTimeout: timeout,
    bodyTimeout: timeout,
  });
  if (resp.statusCode >= 400) {
    throw new Error(`HTTP ${resp.statusCode} from ${url}`);
  }
  return resp.body.text();
}

function buildPubmedQuery(days) {
  const lookback = getDateNDaysAgo(days);
  const journalSlice = JOURNALS.slice(0, 20);
  const journalPart = journalSlice
    .map((j) => `"${j}"[Journal]`)
    .join(" OR ");
  const topicPart = SEARCH_TOPICS.map((t) => `(${t}[tiab])`).join(" OR ");
  return `(${topicPart}) AND "${lookback}"[Date - Publication] : "3000"[Date - Publication] NOT "bronchopulmonary dysplasia"[tiab]`;
}

async function searchPubMed(query, retmax = 50) {
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmax: String(retmax),
    sort: "date",
    retmode: "json",
  });
  try {
    const data = await fetchJSON(`${PUBMED_SEARCH}?${params}`);
    return data?.esearchresult?.idlist || [];
  } catch (e) {
    console.error(`[ERROR] PubMed search failed: ${e.message}`);
    return [];
  }
}

function parseXMLPapers(xml) {
  const papers = [];
  const articleRegex =
    /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
  let match;
  while ((match = articleRegex.exec(xml)) !== null) {
    const block = match[1];
    const getText = (tag) => {
      const m = block.match(
        new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
      );
      return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
    };
    const getAttr = (tag, attr) => {
      const m = block.match(
        new RegExp(`<${tag}[^>]*?${attr}="([^"]*)"`)
      );
      return m ? m[1] : "";
    };

    const title = getText("ArticleTitle");
    const journal = getText("Title");
    const pmid = getText("PMID");
    const abstractParts = [];
    const absRegex =
      /<AbstractText(?:\s+Label="([^"]*)")?[^>]*>([\s\S]*?)<\/AbstractText>/g;
    let absMatch;
    while ((absMatch = absRegex.exec(block)) !== null) {
      const label = absMatch[1] || "";
      const text = absMatch[2].replace(/<[^>]+>/g, "").trim();
      if (text) {
        abstractParts.push(label ? `${label}: ${text}` : text);
      }
    }
    const abstract = abstractParts.join(" ").slice(0, 2000);

    const year = getText("Year");
    const month = getText("Month");
    const day = getText("Day");
    const dateStr = [year, month, day].filter(Boolean).join(" ");

    const keywords = [];
    const kwRegex = /<Keyword>([\s\S]*?)<\/Keyword>/g;
    let kwMatch;
    while ((kwMatch = kwRegex.exec(block)) !== null) {
      const kw = kwMatch[1].trim();
      if (kw) keywords.push(kw);
    }

    papers.push({
      pmid,
      title,
      journal,
      date: dateStr,
      abstract,
      url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "",
      keywords,
      source: "PubMed",
    });
  }
  return papers;
}

async function fetchPubMedDetails(pmids) {
  if (!pmids.length) return [];
  const ids = pmids.join(",");
  const params = new URLSearchParams({
    db: "pubmed",
    id: ids,
    retmode: "xml",
  });
  try {
    const xml = await fetchXML(`${PUBMED_FETCH}?${params}`);
    return parseXMLPapers(xml);
  } catch (e) {
    console.error(`[ERROR] PubMed fetch failed: ${e.message}`);
    return [];
  }
}

async function searchSemanticScholar(days, limit = 20) {
  const query = "borderline personality disorder emotion dysregulation";
  const fromPubDate = getDateNDaysAgo(days).replace(/\//g, "-");
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields:
      "title,authors,year,venue,abstract,citationCount,url,externalIds",
    year: new Date().getFullYear().toString(),
  });
  try {
    const data = await fetchJSON(`${SEMANTIC_SCHOLAR}?${params}`);
    return (data?.data || []).map((p) => ({
      pmid: p.externalIds?.PubMed || "",
      title: p.title || "",
      journal: p.venue || "",
      date: String(p.year || ""),
      abstract: (p.abstract || "").slice(0, 2000),
      url: p.url || (p.externalIds?.PubMed
        ? `https://pubmed.ncbi.nlm.nih.gov/${p.externalIds.PubMed}/`
        : ""),
      keywords: [],
      source: "SemanticScholar",
      citationCount: p.citationCount || 0,
    }));
  } catch (e) {
    console.error(`[ERROR] Semantic Scholar failed: ${e.message}`);
    return [];
  }
}

async function searchOpenAlex(days, perPage = 20) {
  const fromPubDate = getDateNDaysAgo(days).replace(/\//g, "-");
  const params = new URLSearchParams({
    search: "borderline personality disorder",
    filter: `from_publication_date:${fromPubDate}`,
    "per-page": String(perPage),
    sort: "cited_by_count:desc",
  });
  try {
    const data = await fetchJSON(`${OPENALEX}?${params}`);
    return (data?.results || []).map((w) => ({
      pmid: "",
      title: w.title || "",
      journal: w.primary_location?.source?.display_name || "",
      date: w.publication_date || "",
      abstract: (w.abstract_inverted_index
        ? Object.entries(w.abstract_inverted_index)
            .sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]))
            .map(([word]) => word)
            .join(" ")
        : "").slice(0, 2000),
      url: w.doi
        ? `https://doi.org/${w.doi}`
        : (w.primary_location?.landing_page_url || ""),
      keywords: w.keywords?.map((k) => k.keyword) || [],
      source: "OpenAlex",
    }));
  } catch (e) {
    console.error(`[ERROR] OpenAlex failed: ${e.message}`);
    return [];
  }
}

function deduplicatePapers(allPapers) {
  const seen = new Set();
  return allPapers.filter((p) => {
    const key = p.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 80);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const opts = parseArgs();
  console.error(
    `[INFO] Fetching BPD papers from last ${opts.days} days (max ${opts.maxPapers})...`
  );

  const allPapers = [];

  const query = buildPubmedQuery(opts.days);
  console.error("[INFO] PubMed query built");
  const pmids = await searchPubMed(query, opts.maxPapers);
  console.error(`[INFO] PubMed found ${pmids.length} PMIDs`);
  const pubmedPapers = await fetchPubMedDetails(pmids);
  allPapers.push(...pubmedPapers);

  await sleep(1000);

  const ssPapers = await searchSemanticScholar(opts.days, 20);
  console.error(`[INFO] Semantic Scholar found ${ssPapers.length} papers`);
  allPapers.push(...ssPapers);

  await sleep(1000);

  const oaPapers = await searchOpenAlex(opts.days, 20);
  console.error(`[INFO] OpenAlex found ${oaPapers.length} papers`);
  allPapers.push(...oaPapers);

  const unique = deduplicatePapers(allPapers).slice(0, opts.maxPapers);
  console.error(
    `[INFO] After dedup: ${unique.length} unique papers`
  );

  const taipeiDate = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Taipei",
  });

  const output = {
    date: taipeiDate,
    count: unique.length,
    papers: unique,
  };

  const json = JSON.stringify(output, null, 2);
  await writeFile(opts.output, json, "utf-8");
  console.error(`[INFO] Saved to ${opts.output}`);
}

main().catch((e) => {
  console.error(`[FATAL] ${e.message}`);
  process.exit(1);
});
