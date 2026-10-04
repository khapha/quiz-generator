import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { jsonrepair } from "jsonrepair";

// ---------- Config ----------
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(`--${name}`);

const INPUT_DIR = getArg("input", null);
const FORCE = hasFlag("force");
const ONLY = getArg("only", null); // sinh lại 1 file theo slug
const CONCURRENCY = Number(getArg("concurrency", "1"));

const ROOT = join(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "public", "quizzes");
const PROGRESS_DIR = join(ROOT, ".quiz-gen");

const QUESTIONS_PER_SECTION = Number(getArg("questions", "8"));
const MAX_CHUNK_CHARS = 3800;
const MIN_SECTION_CHARS = 300;

if (!INPUT_DIR) {
  console.error("Usage: node scripts/generate-quiz.mjs --input <dir-with-pdfs> [--force] [--only <slug>] [--concurrency 2]");
  process.exit(1);
}

// ---------- Env ----------
const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env"), "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const { AIGW_BASE_URL, AIGW_API_KEY, AIGW_MODEL } = env;
if (!AIGW_BASE_URL || !AIGW_API_KEY || !AIGW_MODEL) {
  console.error("Missing AIGW_BASE_URL / AIGW_API_KEY / AIGW_MODEL in .env");
  process.exit(1);
}

// ---------- Helpers ----------
function slugify(name, index) {
  const n = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${String(index + 1).padStart(2, "0")}-${n}`.slice(0, 60);
}

function cleanTitle(filename) {
  return filename
    .replace(/\.pdf$/i, "")
    .replace(/^\s*\d+\s*[\.\)]\s*/, "")
    .replace(/\s*-\s*SV\s*$/i, "")
    .trim();
}

const SECTION_RE =
  /^(?:(?:chương|bài|phần|điều|mục)\b|[IVX]+\s*[\.\):]|\d+\s*[\.\):])\s*\S/i;

function splitSections(pages) {
  const sections = [];
  let current = { heading: "Nội dung chính", lines: [] };

  for (const page of pages) {
    for (const rawLine of page.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      // heading: ngắn, khớp mẫu đánh số/tiêu đề, không kết thúc bằng dấu câu
      const headingLike =
        line.length <= 90 &&
        SECTION_RE.test(line) &&
        !/[.,;]$/.test(line);

      if (headingLike && current.lines.length > 0) {
        sections.push({ ...current, text: current.lines.join("\n") });
        current = { heading: line, lines: [] };
      } else {
        current.lines.push(line);
      }
    }
  }
  sections.push({ ...current, text: current.lines.join("\n") });

  // gộp phần quá ngắn vào phần trước, tách phần quá dài thành nhiều chunk
  const merged = [];
  for (const s of sections) {
    const text = s.text.trim();
    if (!text) continue;
    const prev = merged[merged.length - 1];
    if (text.length < MIN_SECTION_CHARS && prev) {
      prev.text += "\n" + text;
      continue;
    }
    merged.push({ heading: s.heading, text });
  }

  const chunks = [];
  for (const s of merged) {
    if (s.text.length <= MAX_CHUNK_CHARS) {
      chunks.push({ heading: s.heading, text: s.text });
      continue;
    }
    const paras = s.text.split(/\n(?=\S)/);
    let buf = "";
    let part = 1;
    const totalParts = Math.ceil(s.text.length / MAX_CHUNK_CHARS);
    for (const p of paras) {
      if (buf.length + p.length > MAX_CHUNK_CHARS && buf) {
        chunks.push({ heading: `${s.heading} (phần ${part}/${totalParts})`, text: buf.trim() });
        buf = p;
        part++;
      } else {
        buf += (buf ? "\n" : "") + p;
      }
    }
    if (buf.trim()) {
      chunks.push({ heading: `${s.heading} (phần ${part}/${totalParts})`, text: buf.trim() });
    }
  }
  return chunks;
}

const SYSTEM_PROMPT = `Bạn là chuyên gia xây dựng câu hỏi trắc nghiệm ôn tập từ tài liệu pháp lý và chuyên môn. Bạn tạo câu hỏi bám sát chi tiết tài liệu, kiểm tra đúng kiến thức cốt lõi.`;

function buildUserPrompt(text, heading, docTitle, count) {
  return `Dựa trên NỘI DUNG dưới đây (trích từ chương "${heading}" của tài liệu "${docTitle}"), tạo đúng ${count} câu hỏi trắc nghiệm.

Yêu cầu:
- Khai thác CHI TIẾT nội dung: các con số, thời hạn, điều kiện, mức mức cụ thể, quyền hạn/nghĩa vụ, định nghĩa, phân loại... đều có thể thành câu hỏi.
- Mỗi câu có đúng 4 phương án, chỉ 1 đáp án đúng, các phương án nhiễu hợp lý và cùng chủ đề.
- "source" ghi tên chương/phần mà câu hỏi rút ra.
- "explanation": giải thích ngắn gọn đáp án đúng, trích dẫn chi tiết từ nội dung.
- KHÔNG dùng dấu ngoặc kép " trong nội dung câu hỏi/đáp án/giải thích.

Trả về DUY NHẤT một JSON object theo schema:
{"questions": [{"question": "...", "options": ["...","...","...","..."], "answerIndex": 0, "explanation": "...", "source": "${heading}"}]}

NỘI DUNG:
"""
${text}
"""`;
}

function extractQuestions(content) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in response");
  const raw = content.slice(start, end + 1);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = JSON.parse(jsonrepair(raw));
  }
  if (!Array.isArray(parsed.questions)) throw new Error("missing questions array");
  return parsed.questions
    .map((q) => ({
      question: String(q.question ?? "").trim(),
      options: Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [],
      answerIndex: Number(q.answerIndex),
      explanation: String(q.explanation ?? "").trim(),
      source: String(q.source ?? "").trim(),
    }))
    .filter(
      (q) =>
        q.question.length > 5 &&
        q.options.length >= 2 &&
        Number.isInteger(q.answerIndex) &&
        q.answerIndex >= 0 &&
        q.answerIndex < q.options.length
    );
}

async function callLLMOnce(messages) {
  const res = await fetch(`${AIGW_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AIGW_API_KEY}`,
    },
    body: JSON.stringify({
      model: AIGW_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 32000,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty content (finish_reason=" + data.choices?.[0]?.finish_reason + ")");
  return content;
}

// Một chunk có thể làm model "suy luận vô hạn" (finish_reason=length).
// Khi đó hạ số câu yêu cầu / rút ngắn nội dung thay vì retry y nguyên.
async function generateChunkQuestions(chunk, title, count) {
  const strategies = [
    { text: chunk.text, count },
    { text: chunk.text, count: 4 },
    { text: chunk.text.slice(0, 2500), count: 4 },
  ];
  let lastErr;
  for (const strat of strategies) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return extractQuestions(
          await callLLMOnce([
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: buildUserPrompt(strat.text, chunk.heading, title, strat.count),
            },
          ])
        );
      } catch (err) {
        lastErr = err;
        const msg = String(err.message || "");
        if (msg.includes("finish_reason=length")) {
          console.log(`    hết token suy luận → giảm độ khó yêu cầu`);
          break;
        }
        const wait = msg.includes("429") ? Math.min(20000 * attempt, 90000) : 3000 * attempt;
        console.log(`    attempt ${attempt} failed: ${msg} (đợi ${Math.round(wait / 1000)}s)`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  console.log(`    WARN: bỏ qua phần "${chunk.heading.slice(0, 40)}" (${lastErr?.message})`);
  return [];
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  return results;
}

// ---------- Main ----------
const pdfFiles = readdirSync(INPUT_DIR)
  .filter((f) => f.toLowerCase().endsWith(".pdf"))
  .sort((a, b) => a.localeCompare(b, "vi"));

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(PROGRESS_DIR, { recursive: true });

const index = [];

for (let fi = 0; fi < pdfFiles.length; fi++) {
  const filename = pdfFiles[fi];
  const title = cleanTitle(filename);
  const slug = slugify(filename, fi);
  const outFile = join(OUT_DIR, `${slug}.json`);

  if (ONLY && slug !== ONLY) continue;
  if (!FORCE && existsSync(outFile)) {
    const existing = JSON.parse(readFileSync(outFile, "utf-8"));
    index.push({ id: slug, title, count: existing.questions.length });
    console.log(`[${fi + 1}/${pdfFiles.length}] SKIP (exists): ${title} (${existing.questions.length} câu)`);
    continue;
  }

  console.log(`[${fi + 1}/${pdfFiles.length}] ${filename}`);
  const t0 = Date.now();

  const buf = new Uint8Array(readFileSync(join(INPUT_DIR, filename)));
  const pdf = await getDocumentProxy(buf);
  const { text: pages } = await extractText(pdf, { mergePages: false });
  const pageList = Array.isArray(pages) ? pages : [pages];

  const chunks = splitSections(pageList);
  console.log(`  ${chunks.length} phần/chương, ${pageList.length} trang`);

  const progressDir = join(PROGRESS_DIR, slug);
  mkdirSync(progressDir, { recursive: true });

  const results = await runPool(
    chunks,
    async (chunk, ci) => {
      const chunkFile = join(progressDir, `${ci}.json`);
      if (!FORCE && existsSync(chunkFile)) {
        return JSON.parse(readFileSync(chunkFile, "utf-8"));
      }
      const qs = await generateChunkQuestions(chunk, title, QUESTIONS_PER_SECTION);
      writeFileSync(chunkFile, JSON.stringify(qs), "utf-8");
      if (qs.length > 0) {
        console.log(`    phần ${ci + 1}/${chunks.length} "${chunk.heading.slice(0, 50)}" → ${qs.length} câu`);
      }
      return qs;
    },
    CONCURRENCY
  );

  const seen = new Set();
  const questions = results
    .flat()
    .filter((q) => {
      const key = q.question.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((q, i) => ({ ...q, id: i + 1 }));

  writeFileSync(outFile, JSON.stringify({ id: slug, title, sourceFile: filename, questions }, null, 0), "utf-8");
  index.push({ id: slug, title, count: questions.length });
  console.log(`  → ${questions.length} câu (${Math.round((Date.now() - t0) / 1000)}s)`);
}

index.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2), "utf-8");
console.log(`\nDONE: ${index.reduce((s, q) => s + q.count, 0)} câu trong ${index.length} bộ đề → public/quizzes/`);
