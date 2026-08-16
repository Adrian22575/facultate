import { moduleClassNames } from "@/lib/ui/module-class-names";
import reviewStyles from "../../../../components/workspace-question-review.module.css";
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
    <main className={moduleClassNames([reviewStyles], "app-shell")}>
      <AppHeader
        action={
          <PendingNavigationLink
            className={moduleClassNames([reviewStyles], "btn-back")}
            href="/materiale"
            pendingLabel="Se revine..."
            pendingMode="replace"
          >
            Inapoi la materiale
          </PendingNavigationLink>
        }
        kicker={test.status === "active" ? "Test activ" : "In verificare"}
        title={test.title}
        subtitle="Verifica intrebarile si activeaza testul cand este gata."
      />

      {published ? (
        <section className={moduleClassNames([reviewStyles], "surface")}>
          <div className={moduleClassNames([reviewStyles], "success-state")} role="status">Testul este activ si poate fi rezolvat.</div>
        </section>
      ) : null}

      <section className={moduleClassNames([reviewStyles], "surface")}>
        <div className={moduleClassNames([reviewStyles], "status-copy")}>
          <strong>Vizibilitate</strong>
          <p>
            {test.visibility_scope === "cohort"
              ? "Dupa activare, testul devine vizibil in comunitatea ta."
              : "Vizibilitatea testului este setata automat."}
          </p>
        </div>
      </section>

      <section className={moduleClassNames([reviewStyles], "surface")}>
        <form action={updateDraftMetaAction} className={moduleClassNames([reviewStyles], "ai-form")}>
          <input type="hidden" name="testId" value={test.id} />
          <div className={moduleClassNames([reviewStyles], "selector-container")}>
            <label>
              Titlu test
              <input className={moduleClassNames([reviewStyles], "input-search")} type="text" name="title" defaultValue={test.title} />
            </label>
          </div>
          <div className={moduleClassNames([reviewStyles], "inline-actions")}>
            <button type="submit">Salveaza titlul</button>
            {test.status === "active" ? (
              <PendingNavigationLink
                className={moduleClassNames([reviewStyles], "btn-link secondary")}
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
        <section className={moduleClassNames([reviewStyles], "surface")}>
          <form action={publishDraftAction}>
            <input type="hidden" name="testId" value={test.id} />
            <div className={moduleClassNames([reviewStyles], "inline-actions")}>
              <button type="submit">Confirma si activeaza testul</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className={moduleClassNames([reviewStyles], "surface")}>
        <h2>Intrebari generate</h2>
        <div className={moduleClassNames([reviewStyles], "draft-list")}>
          {(questions || []).map((question) => (
            <article key={question.id} className={moduleClassNames([reviewStyles], "draft-card draft-card-form")}>
              <form action={updateDraftQuestionAction} className={moduleClassNames([reviewStyles], "ai-form")}>
                <input type="hidden" name="testId" value={test.id} />
                <input type="hidden" name="questionId" value={question.id} />

                <div className={moduleClassNames([reviewStyles], "selector-container")}>
                  <label>
                    {`Intrebarea ${question.position}`}
                    <textarea
                      className={moduleClassNames([reviewStyles], "textarea-input")}
                      name="questionText"
                      rows="4"
                      defaultValue={question.question_text}
                    />
                  </label>
                </div>

                {["A", "B", "C", "D"].map((label, index) => (
                  <div className={moduleClassNames([reviewStyles], "selector-container")} key={`${question.id}-${label}`}>
                    <label>
                      {`Varianta ${label}`}
                      <input
                        className={moduleClassNames([reviewStyles], "input-search")}
                        type="text"
                        name={`answer${label}`}
                        defaultValue={question.answers[index] || ""}
                      />
                    </label>
                  </div>
                ))}

                <div className={moduleClassNames([reviewStyles], "selector-container")}>
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

                <div className={moduleClassNames([reviewStyles], "selector-container")}>
                  <label>
                    Explicatie
                    <textarea
                      className={moduleClassNames([reviewStyles], "textarea-input")}
                      name="explanation"
                      rows="3"
                      defaultValue={question.explanation || ""}
                    />
                  </label>
                </div>

                <div className={moduleClassNames([reviewStyles], "inline-actions")}>
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
