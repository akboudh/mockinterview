import { extractResumeTextFromFile } from "@/lib/resume-parser";

function buildPdfBuffer(text: string) {
  const escaped = text.replace(/[()\\]/g, "\\$&");
  const stream = `BT /F1 18 Tf 50 80 Td (${escaped}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${stream.length}>>stream
${stream}
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000063 00000 n 
0000000122 00000 n 
0000000247 00000 n 
0000000360 00000 n 
trailer<</Root 1 0 R/Size 6>>
startxref
430
%%EOF`;

  return Buffer.from(pdf, "utf-8");
}

describe("resume parser", () => {
  it("extracts text from a plain text resume", async () => {
    const file = new File(["Led a marketplace launch.\nBuilt analytics dashboards."], "resume.txt", {
      type: "text/plain"
    });

    const text = await extractResumeTextFromFile(file);

    expect(text).toContain("Led a marketplace launch.");
  });

  it("extracts text from a pdf resume", async () => {
    const file = new File([buildPdfBuffer("Hello PDF Resume Text")], "resume.pdf", {
      type: "application/pdf"
    });

    const text = await extractResumeTextFromFile(file);

    expect(text).toContain("Hello PDF Resume Text");
  });

  it("extracts readable text from an html resume", async () => {
    const file = new File(
      ["<html><body><h1>Jane Doe</h1><p>Built analytics dashboards &amp; led launches.</p></body></html>"],
      "resume.html",
      { type: "text/html" }
    );

    const text = await extractResumeTextFromFile(file);

    expect(text).toContain("Jane Doe");
    expect(text).toContain("Built analytics dashboards & led launches.");
  });
});
