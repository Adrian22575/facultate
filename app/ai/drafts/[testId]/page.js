import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import {
  publishDraftAction,
  updateDraftMetaAction,
  updateDraftQuestionAction
} from "@/app/ai/actions";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  return {
    title: `Editor test | ${resolvedParams.testId}`
  };
}

export default async function AIDraftPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const user = await getOptionalUser();

  if (!user) {
    redirect(`/auth/login?next=/materiale/drafts/${resolvedParams.testId}`);
  }

  if (isDemoUser(user)) {
    redirect("/materiale?error=Modul%20demo%20nu%20deschide%20teste%20private.");
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref(`/materiale/drafts/${resolvedParams.testId}`));
  }

  const supabase = createAdminClient();
  const { data: test } = await supabase
    .from("user_generated_tests")
    .select("id, title, status, total_questions, published_at, created_at, visibility_scope")
    .eq("id", resolvedParams.testId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!test) {
    notFound();
  }

  const { data: questions } = await supabase
    .from("user_generated_test_questions")
    .select("id, position, question_text, answers, correct_index, explanation")
    .eq("test_id", test.id)
    .eq("user_id", user.id)
    .order("position", { ascending: true });

  const published = resolvedSearchParams?.published === "1";

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <PendingNavigationLink
            className="btn-back"
            href="/materiale"
            pendingLabel="Se revine..."
            pendingMode="replace"
          >
            Inapoi la workspace
          </PendingNavigationLink>
        }
        kicker={test.status === "active" ? "Test activ" : "In verificare"}
        title={test.title}
        subtitle="Verifica intrebarile si activeaza testul cand este gata."
      />

      {published ? (
        <section className="surface">
          <div className="success-state" role="status">Testul este activ si poate fi rezolvat.</div>
        </section>
      ) : null}

      <section className="surface">
        <div className="status-copy">
          <strong>Vizibilitate</strong>
          <p>
            {test.visibility_scope === "cohort"
              ? "Dupa activare, testul devine vizibil in comunitatea ta."
              : "Vizibilitatea testului este setata automat."}
          </p>
        </div>
      </section>

      <section className="surface">
        <form action={updateDraftMetaAction} className="ai-form">
          <input type="hidden" name="testId" value={test.id} />
          <div className="selector-container">
            <label>
              Titlu test
              <input className="input-search" type="text" name="title" defaultValue={test.title} />
            </label>
          </div>
          <div className="inline-actions">
            <button type="submit">Salveaza titlul</button>
            {test.status === "active" ? (
              <PendingNavigationLink
                className="btn-link secondary"
                href={`/testele-mele/${test.id}`}
                pendingLabel="Se deschide testul..."
                pendingMode="replace"
              >
                Deschide testul activ
              </PendingNavigationLink>
            ) : null}
          </div>
        </form>
      </section>

      {test.status !== "active" ? (
        <section className="surface">
          <form action={publishDraftAction}>
            <input type="hidden" name="testId" value={test.id} />
            <div className="inline-actions">
              <button type="submit">Confirma si activeaza testul</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="surface">
        <h2>Intrebari generate</h2>
        <div className="draft-list">
          {(questions || []).map((question) => (
            <article key={question.id} className="draft-card draft-card-form">
              <form action={updateDraftQuestionAction} className="ai-form">
                <input type="hidden" name="testId" value={test.id} />
                <input type="hidden" name="questionId" value={question.id} />

                <div className="selector-container">
                  <label>
                    {`Intrebarea ${question.position}`}
                    <textarea
                      className="textarea-input"
                      name="questionText"
                      rows="4"
                      defaultValue={question.question_text}
                    />
                  </label>
                </div>

                {["A", "B", "C", "D"].map((label, index) => (
                  <div className="selector-container" key={`${question.id}-${label}`}>
                    <label>
                      {`Varianta ${label}`}
                      <input
                        className="input-search"
                        type="text"
                        name={`answer${label}`}
                        defaultValue={question.answers[index] || ""}
                      />
                    </label>
                  </div>
                ))}

                <div className="selector-container">
                  <label>
                    Raspuns corect
                    <select name="correctIndex" defaultValue={String(question.correct_index)}>
                      <option value="0">A</option>
                      <option value="1">B</option>
                      <option value="2">C</option>
                      <option value="3">D</option>
                    </select>
                  </label>
                </div>

                <div className="selector-container">
                  <label>
                    Explicatie
                    <textarea
                      className="textarea-input"
                      name="explanation"
                      rows="3"
                      defaultValue={question.explanation || ""}
                    />
                  </label>
                </div>

                <div className="inline-actions">
                  <button type="submit">Salveaza intrebarea</button>
                </div>
              </form>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
