import Link from "next/link";

import { PendingNavigationLink } from "@/components/pending-navigation-link";

function formatProgress(progress) {
  const viewed = Number(progress?.study_viewed_count || 0);
  const total = Number(progress?.study_total_questions || 0);
  const bestScore = Number(progress?.test_best_score_percent || 0);
  const mistakeCount = Array.isArray(progress?.mistake_question_ids)
    ? progress.mistake_question_ids.filter(Boolean).length
    : 0;

  return {
    viewed,
    total,
    bestScore,
    mistakeCount,
    studyLabel: total ? `${viewed} din ${total} intrebari parcurse` : "Incepe cu primul set de grile"
  };
}

export function SubjectLearningHub({
  subject,
  studySets = [],
  progress = null,
  locked = false,
  lockHref = "/cont?section=plans"
}) {
  const metrics = formatProgress(progress);
  const uploadHref = `/materiale/invata?subjectId=${encodeURIComponent(subject.id)}`;
  const studyHref = locked ? lockHref : `/materii/${subject.id}/studiu`;
  const testHref = locked ? lockHref : `/materii/${subject.id}/test`;
  const mistakesHref = locked ? lockHref : `/materii/${subject.id}/test?mode=mistakes`;
  const hasUnfinishedStudy = metrics.total > 0 && metrics.viewed < metrics.total;
  const nextAction = locked
    ? { href: lockHref, label: "Vezi planuri", copy: "Activeaza accesul pentru grile si teste pe aceasta materie." }
    : metrics.mistakeCount
      ? {
          href: mistakesHref,
          label: "Repeta greselile",
          copy: `${metrics.mistakeCount} intrebari raman de consolidat.`
        }
      : hasUnfinishedStudy
      ? { href: studyHref, label: "Continua grilele", copy: `${metrics.total - metrics.viewed} intrebari ramase de parcurs.` }
      : metrics.bestScore
        ? { href: testHref, label: "Imbunatateste scorul", copy: `Cel mai bun rezultat: ${metrics.bestScore}%.` }
        : { href: studyHref, label: "Incepe cu grilele", copy: "Parcurge intai intrebarile, apoi verifica-te cu un test." };

  return (
    <section className="subject-learning-hub" aria-label={`Zona de invatare pentru ${subject.title}`}>
      <div className="subject-learning-hub-intro">
        <div>
          <span className="ui-section-label">Materia ta</span>
          <h2>Invata in ritmul tau, din aceeasi materie.</h2>
          <p>Gasesti materialele comunitatii, apoi alegi cum vrei sa exersezi.</p>
        </div>
        <div className="subject-learning-progress" aria-label="Progresul tau">
          <span>Progres</span>
          <strong>{metrics.bestScore ? `${metrics.bestScore}%` : "—"}</strong>
          <small>{metrics.bestScore ? "cel mai bun test" : "inca nu ai un test finalizat"}</small>
        </div>
      </div>

      <div className="subject-learning-hub-grid">
        <article className="subject-learning-materials-card">
          <div className="subject-learning-card-head">
            <div>
              <span className="ui-section-label">Materiale de studiu</span>
              <h3>Materiale pentru {subject.title}</h3>
            </div>
            <span className="subject-learning-count">{studySets.length}</span>
          </div>

          {studySets.length ? (
            <div className="subject-learning-material-list">
              {studySets.slice(0, 3).map((studySet) => (
                <Link key={studySet.id} className="subject-learning-material-row" href={`/materiale/invata/${studySet.id}`}>
                  <span>
                    <strong>{studySet.title}</strong>
                    <small>{`${studySet.chapterCount} capitole · ${studySet.flashcardCount} flashcards · ${studySet.questionCount} intrebari`}</small>
                  </span>
                  <em>{studySet.isOwner ? "Al tau" : "Comunitate"}</em>
                </Link>
              ))}
            </div>
          ) : (
            <p className="subject-learning-empty">Nu exista inca un material pregatit pentru aceasta materie.</p>
          )}

          <div className="subject-learning-card-actions">
            {studySets.length ? (
              <>
                <PendingNavigationLink
                  href={`/materiale/invata/${studySets[0].id}`}
                  className="btn-back"
                  pendingLabel="Se deschide materialul..."
                >
                  Continua materialul
                </PendingNavigationLink>
                <PendingNavigationLink href="/materiale/activitate?tab=learning" className="btn-link secondary" pendingLabel="Se deschide biblioteca...">
                  Vezi biblioteca
                </PendingNavigationLink>
              </>
            ) : (
              <PendingNavigationLink href={uploadHref} className="btn-back" pendingLabel="Se deschide incarcarea...">
                Adauga material
              </PendingNavigationLink>
            )}
          </div>
        </article>

        <article className="subject-learning-next-card">
          <span className="ui-section-label">Teste si grile</span>
          <h3>Alege urmatorul pas.</h3>
          <p>{nextAction.copy}</p>
          <div className="subject-learning-next-links">
            <PendingNavigationLink
              className="subject-learning-next-primary"
              href={nextAction.href}
              pendingLabel="Se deschid grilele..."
              pendingMode="replace"
            >
              {nextAction.label}
            </PendingNavigationLink>
          </div>
        </article>
      </div>
    </section>
  );
}
