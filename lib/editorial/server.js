import "server-only";

import { hasSupabaseServiceEnv } from "@/lib/env/server";
import { getEditorialGenerationPreview } from "@/lib/editorial/automation";
import { createAdminClient } from "@/lib/supabase/admin";

const LIST_COLUMNS = "id, slug, title, subtitle, summary, period_start, period_end, primary_topic, categories, reading_minutes, quality_score, published_at, updated_at";
const FULL_COLUMNS = `${LIST_COLUMNS}, key_takeaways, sections, student_implications, weekly_term, conclusion, sources, internal_links, seo_title, meta_description, social_description, image_prompt, word_count, fact_check_status, fact_check_report, status, correction_note, generation_model, last_reviewed_at, created_at`;

function adminClient() { return hasSupabaseServiceEnv() ? createAdminClient() : null; }

export async function getEditorialOverview() {
  const admin = adminClient();
  if (!admin) return { featured: null, articles: [], categories: [] };
  const { data, error } = await admin.from("editorial_articles").select(LIST_COLUMNS).eq("status", "published").order("published_at", { ascending: false }).limit(80);
  if (error) throw error;
  const articles = data || [];
  const categories = [...new Set(articles.flatMap((article) => article.categories || []))].sort((a, b) => a.localeCompare(b, "ro"));
  return { featured: articles[0] || null, articles: articles.slice(1), categories };
}

export async function getEditorialArticle(slug, { includeUnpublished = false } = {}) {
  const admin = adminClient();
  if (!admin) return null;
  let query = admin.from("editorial_articles").select(FULL_COLUMNS).eq("slug", slug);
  if (!includeUnpublished) query = query.eq("status", "published");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getEditorialAdminArticleById(articleId) {
  const admin = adminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("editorial_articles")
    .select(FULL_COLUMNS)
    .eq("id", articleId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getEditorialSitemapEntries() {
  const admin = adminClient();
  if (!admin) return [];
  const { data, error } = await admin.from("editorial_articles").select("slug, updated_at").eq("status", "published").order("updated_at", { ascending: false }).limit(10000);
  if (error) throw error;
  return data || [];
}

export async function getEditorialAdminOverview() {
  const admin = adminClient();
  if (!admin) return { articles: [], runs: [], automationSettings: null, warning: "Conexiunea de administrare nu este disponibilă." };
  const [{ data: articles, error: articleError }, { data: runs, error: runError }, { data: automationSettings, error: automationError }] = await Promise.all([
    admin.from("editorial_articles").select(FULL_COLUMNS).order("updated_at", { ascending: false }).limit(100),
    admin.from("editorial_generation_runs").select("id, run_key, run_date, week_start, week_end, trigger_source, status, model, article_id, candidate_count, source_count, topic_count, quality_score, rejection_reason, error_message, validation_report, notification_sent, started_at, finished_at").order("started_at", { ascending: false }).limit(30),
    admin.from("editorial_automation_settings").select("workflow, enabled, frequency_days, scheduled_hour, model, notify_telegram, last_scheduled_for, updated_at").eq("workflow", "editorial").maybeSingle()
  ]);
  if (articleError) throw articleError;
  if (runError) throw runError;
  if (automationError) throw automationError;
  return {
    articles: articles || [],
    runs: runs || [],
    automationSettings: automationSettings || null,
    generationPreview: getEditorialGenerationPreview({ model: automationSettings?.model }),
    warning: null
  };
}
