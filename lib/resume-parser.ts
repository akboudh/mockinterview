import { execFile } from "child_process";
import { existsSync } from "fs";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";

import { normalizeResumeText } from "@/lib/personalization";

const execFileAsync = promisify(execFile);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown"]);
const HTML_EXTENSIONS = new Set([".html", ".htm"]);
const TEXTUTIL_EXTENSIONS = new Set([".doc", ".docx", ".rtf", ".rtfd"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const TEXTUTIL_PATH = "/usr/bin/textutil";
const PDF_WORKER_PATH = path.join(
  process.cwd(),
  "node_modules",
  "pdf-parse",
  "dist",
  "worker",
  "pdf.worker.mjs"
);

let pdfWorkerConfigured = false;
let pdfParseConstructorPromise: Promise<typeof import("pdf-parse").PDFParse> | null = null;

function extname(filename: string) {
  return path.extname(filename).toLowerCase();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function extractReadableHtmlText(value: string) {
  return normalizeResumeText(
    decodeHtmlEntities(value)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

async function loadPdfParseConstructor() {
  if (!pdfParseConstructorPromise) {
    pdfParseConstructorPromise = import("pdf-parse").then((module) => module.PDFParse);
  }

  return pdfParseConstructorPromise;
}

function ensurePdfWorkerConfigured(PDFParse: typeof import("pdf-parse").PDFParse) {
  if (pdfWorkerConfigured) {
    return;
  }

  if (existsSync(PDF_WORKER_PATH)) {
    PDFParse.setWorker(PDF_WORKER_PATH);
  }

  pdfWorkerConfigured = true;
}

function canUseTextutil() {
  return process.platform === "darwin" && existsSync(TEXTUTIL_PATH);
}

export async function extractResumeTextFromFile(file: File) {
  if (file.size > MAX_RESUME_BYTES) {
    throw new Error("Resume upload is limited to 5 MB.");
  }

  const extension = extname(file.name);

  if (HTML_EXTENSIONS.has(extension) || file.type === "text/html") {
    const text = extractReadableHtmlText(await file.text());
    if (!text) {
      throw new Error("The uploaded HTML resume did not contain readable text.");
    }
    return text;
  }

  if (TEXT_EXTENSIONS.has(extension) || (file.type.startsWith("text/") && file.type !== "text/html")) {
    const text = normalizeResumeText(await file.text());
    if (!text) {
      throw new Error("The uploaded resume file did not contain readable text.");
    }
    return text;
  }

  if (PDF_EXTENSIONS.has(extension) || file.type === "application/pdf") {
    const PDFParse = await loadPdfParseConstructor();
    ensurePdfWorkerConfigured(PDFParse);
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: pdfBuffer });
    let text = "";

    try {
      const parsed = await parser.getText();
      text = normalizeResumeText(parsed.text ?? "");
    } finally {
      await parser.destroy().catch(() => undefined);
    }

    if (!text) {
      throw new Error("The uploaded PDF did not contain extractable text.");
    }

    return text;
  }

  if (!TEXTUTIL_EXTENSIONS.has(extension)) {
    throw new Error(
      "Upload a .pdf, .txt, .md, or .html resume. On macOS, .doc, .docx, and .rtf are also supported."
    );
  }

  if (!canUseTextutil()) {
    throw new Error(
      "This deployment can parse .pdf, .txt, .md, and .html resumes directly. .doc, .docx, and .rtf conversion requires macOS textutil."
    );
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "mockinterview-resume-"));
  const tempFilePath = path.join(tempDir, file.name);

  try {
    await writeFile(tempFilePath, Buffer.from(await file.arrayBuffer()));
    const { stdout } = await execFileAsync(TEXTUTIL_PATH, [
      "-convert",
      "txt",
      "-stdout",
      tempFilePath
    ]);
    const text = normalizeResumeText(stdout);

    if (!text) {
      throw new Error("The uploaded resume file could not be converted into readable text.");
    }

    return text;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
