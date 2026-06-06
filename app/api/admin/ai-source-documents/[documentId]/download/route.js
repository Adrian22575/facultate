import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { downloadSourceDocument } from "@/lib/ai/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireApiAdmin() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !(await isAdminUser(user))) {
    return null;
  }

  return user;
}

export async function GET(_request, { params }) {
  const resolvedParams = await params;
  const adminUser = await requireApiAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const documentId = typeof resolvedParams?.documentId === "string" ? resolvedParams.documentId : "";
  if (!documentId) {
    return NextResponse.json({ error: "invalid_document_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: sourceDocument, error } = await admin
    .from("ai_source_documents")
    .select("id, original_filename, mime_type, storage_bucket, storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "document_lookup_failed" }, { status: 500 });
  }

  if (!sourceDocument) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }

  if (!sourceDocument.storage_bucket || !sourceDocument.storage_path) {
    return NextResponse.json({ error: "source_file_unavailable" }, { status: 404 });
  }

  try {
    const buffer = await downloadSourceDocument({
      storageBucket: sourceDocument.storage_bucket,
      storagePath: sourceDocument.storage_path
    });
    const filename = sourceDocument.original_filename || `source-${documentId}`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": sourceDocument.mime_type || "application/octet-stream",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store"
      }
    });
  } catch (downloadError) {
    return NextResponse.json(
      {
        error: "source_file_download_failed",
        message:
          downloadError instanceof Error
            ? downloadError.message
            : "Fisierul sursa nu a putut fi descarcat."
      },
      { status: 404 }
    );
  }
}
