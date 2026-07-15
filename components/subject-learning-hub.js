import Link from "next/link";

import { PendingNavigationLink } from "@/components/pending-navigation-link";

function formatProgress(progress) {
  const viewed = Number(progress?.study_viewed_count || 0);
  const total = Number(progress?.study_total_questions || 0);
  const bestScore = Number(progress?.test_best_score_percent || 0);

  return {
    viewed,
    total,
    bestScore,
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
              <PendingNavigationLink href="/materiale/activitate?tab=learning" className="btn-link secondary" pendingLabel="Se deschide biblioteca...">
                Vezi biblioteca
              </PendingNavigationLink>
            ) : null}
            <PendingNavigationLink href={uploadHref} className="btn-back" pendingLabel="Se deschide incarcarea...">
              Adauga material
            </PendingNavigationLink>
          </div>
        </article>

        <article className="subject-learning-next-card">
          <span className="ui-section-label">Teste si grile</span>
          <h3>Alege urmatorul pas.</h3>
          <p>{metrics.studyLabel}</p>
          <div className="subject-learning-next-links">
            <Link href={studyHref}>{locked ? "Vezi planuri" : "Parcurge grilele"}</Link>
            {!locked ? <Link href={testHref}>Da un test</Link> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
