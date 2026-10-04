import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node probe-pdf.mjs <dir>");
  process.exit(1);
}

const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();

for (const name of files) {
  try {
    const buf = new Uint8Array(readFileSync(join(dir, name)));
    const pdf = await getDocumentProxy(buf);
    const { text, totalPages } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    const total = pages.join("").replace(/\s+/g, " ").length;
    const pagesWithText = pages.filter((p) => p.replace(/\s+/g, "").length > 40).length;
    console.log(
      `${name}\n  pages=${totalPages} chars=${total} pages_with_text=${pagesWithText}`
    );
  } catch (err) {
    console.log(`${name}\n  ERROR: ${err.message}`);
  }
}
