import { NextResponse } from "next/server";

import { downloadSourceDocument } from "@/lib/ai/storage";
import { canAccessSourceDocument } from "@/lib/question-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user || null;
}

function safeFilename(value, fallback) {
  const filename = String(value || "").trim();
  return filename || fallback;
}

export async function GET(_request, { params }) {
  const resolvedParams = await params;
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const documentId = typeof resolvedParams?.documentId === "string" ? resolvedParams.documentId : "";
  if (!documentId) {
    return NextResponse.json({ error: "invalid_document_id" }, { status: 400 });
  }

  let allowed = false;
  try {
    allowed = await canAccessSourceDocument({ userId: user.id, documentId });
  } catch {
    return NextResponse.json({ error: "document_access_check_failed" }, { status: 500 });
  }

  if (!allowed) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: sourceDocument, error } = await admin
    .from("ai_source_documents")
    .select("id, source_kind, original_filename, mime_type, storage_bucket, storage_path, extracted_text")
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "document_lookup_failed" }, { status: 500 });
  }

  if (!sourceDocument) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }

  if (sourceDocument.storage_bucket && sourceDocument.storage_path) {
    try {
      const buffer = await downloadSourceDocument({
        storageBucket: sourceDocument.storage_bucket,
        storagePath: sourceDocument.storage_path
      });
      const filename = safeFilename(sourceDocument.original_filename, `sursa-${documentId}`);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": sourceDocument.mime_type || "application/octet-stream",
          "Content-Length": String(buffer.length),
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "Cache-Control": "private, no-store"
        }
      });
    } catch {
      return NextResponse.json({ error: "source_file_unavailable" }, { status: 404 });
    }
  }

  if (sourceDocument.source_kind === "manual" && sourceDocument.extracted_text) {
    const filename = safeFilename(sourceDocument.original_filename, `sursa-${documentId}.txt`);
    return new NextResponse(sourceDocument.extracted_text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store"
      }
    });
  }

  return NextResponse.json({ error: "source_file_unavailable" }, { status: 404 });
}
