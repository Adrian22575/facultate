const fs = require("node:fs/promises");
const { PDFParse } = require("pdf-parse");

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    process.stdout.write(JSON.stringify({ ok: false, error: "Missing PDF path." }));
    process.exitCode = 1;
    return;
  }

  let parser = null;

  try {
    const buffer = await fs.readFile(pdfPath);
    parser = new PDFParse({ data: buffer });
    let info = null;
    try {
      info = await parser.getInfo();
    } catch {
      info = null;
    }
    const result = await parser.getText({
      pageJoiner: "\n\n[[PAGE page_number / total_number]]\n\n"
    });

    process.stdout.write(
      JSON.stringify({
        ok: true,
        text: result?.text || "",
        pageCount: Number(info?.total || result?.total || 0) || null,
        extractedCharacterCount: String(result?.text || "").length
      })
    );
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "PDF parsing failed."
      })
    );
    process.exitCode = 1;
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch (error) {
        // Ignore cleanup failures from the worker.
      }
    }
  }
}

main().catch((error) => {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "PDF parsing failed."
    })
  );
  process.exitCode = 1;
});
