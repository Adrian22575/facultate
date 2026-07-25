function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function getSubjectProgressSummary(row = null) {
  const studyTotal = asNumber(row?.study_total_questions);
  const studyViewed = asNumber(row?.study_viewed_count);
  const interactiveTotal = asNumber(row?.interactive_total_questions);
  const interactiveAnswered = asNumber(row?.interactive_answered);
  const testPercent = clampPercent(asNumber(row?.test_best_score_percent));
  const studyPercent = studyTotal > 0 ? clampPercent((studyViewed / studyTotal) * 100) : 0;
  const interactivePercent =
    interactiveTotal > 0 ? clampPercent((interactiveAnswered / interactiveTotal) * 100) : 0;
  const percent = Math.max(studyPercent, interactivePercent, testPercent);

  return {
    percent,
    study: { viewed: studyViewed, total: studyTotal, percent: studyPercent },
    interactive: { answered: interactiveAnswered, total: interactiveTotal, percent: interactivePercent },
    testPercent,
    lastMode: row?.last_mode || null,
    lastActivityAt: row?.last_activity_at || null
  };
}

export function getSubjectProgressLabel(progress) {
  const percent = asNumber(progress?.percent);

  if (percent >= 100) {
    return { title: "Studiu finalizat", action: "Reia materia" };
  }

  if (percent > 0) {
    return { title: "Progres studiu", action: "Continua" };
  }

  return { title: "Neinceputa", action: "Incepe" };
}

export function getSubjectInitials(title) {
  const words = String(title || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "M";
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase("ro");
  return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase("ro");
}

export function getSubjectPaletteIndex(subjectId, paletteCount = 6) {
  const value = String(subjectId || "");
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash) % Math.max(1, paletteCount);
}

export function sortSubjectLibrary(items, sort = "recent") {
  return [...items].sort((left, right) => {
    if (sort === "progress") {
      const progressDifference = asNumber(right.progress?.percent) - asNumber(left.progress?.percent);
      if (progressDifference) return progressDifference;
    }

    if (sort === "recent") {
      const activityDifference =
        new Date(right.lastActivityAt || 0).getTime() - new Date(left.lastActivityAt || 0).getTime();
      if (activityDifference) return activityDifference;
    }

    return String(left.title || "").localeCompare(String(right.title || ""), "ro");
  });
}

export function getSubjectResumeCandidate({ lastSession = null, subjectLibrary = [] } = {}) {
  const subjectsById = new Map(subjectLibrary.map((subject) => [subject.id, subject]));
  const localSubject = lastSession?.subjectId ? subjectsById.get(lastSession.subjectId) : null;

  if (localSubject && lastSession?.url?.startsWith(`/materii/${localSubject.id}/`)) {
    return {
      subject: localSubject,
      href: lastSession.url,
      mode: lastSession.mode || localSubject.lastMode || "Materia ta"
    };
  }

  const recentSubject = sortSubjectLibrary(
    subjectLibrary.filter((subject) => subject.lastActivityAt),
    "recent"
  )[0];

  if (!recentSubject) return null;

  return {
    subject: recentSubject,
    href: `/materii/${recentSubject.id}`,
    mode: recentSubject.lastMode || "Materia ta"
  };
}
