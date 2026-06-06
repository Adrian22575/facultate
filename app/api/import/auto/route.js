import { NextResponse } from "next/server";

import {
  buildPreparedFileFromFormFile,
  createAutoImportJob
} from "@/lib/ai/import-pipeline";
import {
  createSourceDocumentForPreparedFile,
  getImportRequestContext,
  jsonError
} from "@/app/api/import/_shared";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request) {
  const context = await getImportRequestContext();
  if (context.error) {
    return context.error;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("sourceFile") instanceof File ? formData.get("sourceFile") : null;
    if (!file) {
      return NextResponse.json({ error: "Alege fisierul pentru import." }, { status: 400 });
    }

    const preparedFile = await buildPreparedFileFromFormFile(file);
    const sourceDocumentId = await createSourceDocumentForPreparedFile({
      userId: context.user.id,
      preparedFile
    });

    const status = await createAutoImportJob({
      userId: context.user.id,
      sourceDocumentId,
      sourceType: preparedFile.sourceKind,
      fileName: preparedFile.originalFilename,
      academicContext: context.academicContext,
      metadata: {
        sourceMimeType: preparedFile.mimeType,
        sourceSizeBytes: preparedFile.sizeBytes
      }
    });

    return NextResponse.json(status, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return jsonError(error, "Nu am putut porni importul automat.");
  }
}
