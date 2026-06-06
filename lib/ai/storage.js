import "server-only";

import {
  AI_SOURCE_UPLOAD_BUCKET,
  AI_SOURCE_UPLOAD_MAX_BYTES,
  AI_SOURCE_UPLOAD_MAX_LABEL
} from "@/lib/ai/upload-limits";
import { hasSupabaseServiceEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const SOURCE_BUCKET = AI_SOURCE_UPLOAD_BUCKET;
export const SOURCE_BUCKET_BACKFILL_MIGRATION =
  "0014_source_documents_storage_backfill.sql";
export const SOURCE_BUCKET_SETUP_MESSAGE =
  "Aplicatia nu este configurata complet pentru fisiere. Lipseste spatiul privat de documente din Supabase. Ruleaza migrarea 0014_source_documents_storage_backfill.sql.";
export const SOURCE_BUCKET_LIMIT_MESSAGE =
  `Spatiul privat de documente accepta fisiere prea mici. Actualizeaza limita de upload ca sa permiti fisiere pana la ${AI_SOURCE_UPLOAD_MAX_LABEL}.`;

function isMissingBucketError(error) {
  return Boolean(error?.message?.toLowerCase().includes("bucket not found"));
}

export function buildStoragePath(userId, originalFilename) {
  const timestamp = Date.now();
  return `${userId}/${timestamp}-${originalFilename}`;
}

export async function getSourceBucketStatus() {
  if (!hasSupabaseServiceEnv()) {
    return {
      ready: false,
      reason: "missing_service_role",
      message:
        "Lipseste cheia server-side Supabase. Completeaza SUPABASE_SERVICE_ROLE_KEY inainte sa verifici Storage."
    };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.getBucket(SOURCE_BUCKET);

    if (error) {
      if (isMissingBucketError(error)) {
        return {
          ready: false,
          reason: "missing_bucket",
          message: SOURCE_BUCKET_SETUP_MESSAGE
        };
      }

      return {
        ready: false,
        reason: "check_failed",
        message:
          "Nu am putut verifica spatiul privat de documente din Supabase. Verifica setup-ul Storage si incearca din nou."
      };
    }

    const bucketReady = Boolean(data?.id === SOURCE_BUCKET || data?.name === SOURCE_BUCKET);
    const fileSizeLimit = Number(data?.file_size_limit || 0);

    if (bucketReady && fileSizeLimit > 0 && fileSizeLimit < AI_SOURCE_UPLOAD_MAX_BYTES) {
      return {
        ready: false,
        reason: "file_size_limit_too_low",
        message: SOURCE_BUCKET_LIMIT_MESSAGE
      };
    }

    return {
      ready: bucketReady,
      reason: "ready",
      message: null
    };
  } catch (error) {
    if (isMissingBucketError(error)) {
      return {
        ready: false,
        reason: "missing_bucket",
        message: SOURCE_BUCKET_SETUP_MESSAGE
      };
    }

    return {
      ready: false,
      reason: "check_failed",
      message:
        "Nu am putut verifica spatiul privat de documente din Supabase. Verifica setup-ul Storage si incearca din nou."
    };
  }
}

export async function assertSourceBucketReady() {
  const status = await getSourceBucketStatus();

  if (!status.ready) {
    throw new Error(status.message || SOURCE_BUCKET_SETUP_MESSAGE);
  }

  return status;
}

export async function uploadSourceDocument({
  userId,
  originalFilename,
  mimeType,
  buffer
}) {
  const supabase = createAdminClient();
  const storagePath = buildStoragePath(userId, originalFilename);

  const { error } = await supabase.storage.from(SOURCE_BUCKET).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false
  });

  if (error) {
    throw error;
  }

  return {
    storageBucket: SOURCE_BUCKET,
    storagePath
  };
}

export async function downloadSourceDocument({
  storageBucket,
  storagePath
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(storageBucket)
    .download(storagePath);

  if (error) {
    throw error;
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function deleteSourceDocumentObject({
  storageBucket,
  storagePath
}) {
  if (!storageBucket || !storagePath) {
    return;
  }

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(storageBucket)
    .remove([storagePath]);

  if (error) {
    throw error;
  }
}
