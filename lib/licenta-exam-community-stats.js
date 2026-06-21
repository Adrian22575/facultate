import "server-only";

const RECENT_ATTEMPT_LIMIT = 5000;
const MIN_SCOPE_PARTICIPANTS = 3;

const SCORE_BUCKETS = [
  { key: "0-20", label: "0-20%", min: 0, max: 20 },
  { key: "21-40", label: "21-40%", min: 21, max: 40 },
  { key: "41-60", label: "41-60%", min: 41, max: 60 },
  { key: "61-80", label: "61-80%", min: 61, max: 80 },
  { key: "81-100", label: "81-100%", min: 81, max: 100 }
];

const MODE_LABELS = {
  quick: "Runda rapida",
  custom: "Personalizat",
  mistakes: "Greseli",
  verify: "Corect/gresit"
};

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function getScoreBucket(score) {
  return SCORE_BUCKETS.find((bucket) => score >= bucket.min && score <= bucket.max) || SCORE_BUCKETS[0];
}

function normalizeAttempt(row) {
  return {
    id: row.id,
    userId: row.user_id,
    mode: row.mode,
    scorePercent: Number(row.score_percent),
    correctCount: Number(row.correct_count || 0),
    questionCount: Number(row.question_count || 0),
    wrongCount: Number(row.wrong_count || 0),
    unansweredCount: Number(row.unanswered_count || 0),
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: row.created_at
  };
}

function formatDateLabel(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short" }).format(new Date(value));
  } catch {
    return "";
  }
}

export function getStatsScopeCandidates(academicContext) {
  const institutionName = academicContext?.institution?.name || "comunitatea ta";
  const programName = academicContext?.programUnit?.name || institutionName;
  const cohortName = academicContext?.cohort?.label || programName;

  return [
    academicContext?.membership?.cohort_id
      ? {
          key: "cohort",
          column: "target_cohort_id",
          id: academicContext.membership.cohort_id,
          label: cohortName
        }
      : null,
    academicContext?.membership?.program_unit_id
      ? {
          key: "program",
          column: "target_unit_id",
          id: academicContext.membership.program_unit_id,
          label: programName
        }
      : null,
    academicContext?.membership?.institution_id
      ? {
          key: "institution",
          column: "target_institution_id",
          id: academicContext.membership.institution_id,
          label: institutionName
        }
      : null
  ].filter(Boolean);
}

function summarizeRows(rows, { userId, scorePercent, scope }) {
  const attempts = rows
    .map((row) => ({
      userId: row.user_id,
      scorePercent: Number(row.score_percent),
      createdAt: row.created_at
    }))
    .filter((row) => Number.isInteger(row.scorePercent));

  const participantIds = new Set(attempts.map((row) => row.userId).filter(Boolean));
  const scores = attempts.map((row) => row.scorePercent);
  const userAttempts = attempts.filter((row) => row.userId === userId);
  const userBestScore = userAttempts.length
    ? Math.max(...userAttempts.map((row) => row.scorePercent))
    : scorePercent;
  const comparisonScore = Number.isInteger(scorePercent) ? scorePercent : userBestScore;

  const bestByUser = new Map();
  for (const attempt of attempts) {
    const currentBest = bestByUser.get(attempt.userId);
    if (currentBest === undefined || attempt.scorePercent > currentBest) {
      bestByUser.set(attempt.userId, attempt.scorePercent);
    }
  }

  const rankedBestScores = Array.from(bestByUser.entries()).sort((left, right) => right[1] - left[1]);
  const userRankIndex = rankedBestScores.findIndex(([rankedUserId]) => rankedUserId === userId);
  const userRank = userRankIndex >= 0 ? userRankIndex + 1 : null;
  const hasComparisonPeers = participantIds.size > 1;
  const percentile = hasComparisonPeers && scores.length
    ? Math.round((scores.filter((score) => score <= comparisonScore).length / scores.length) * 100)
    : null;

  const distribution = SCORE_BUCKETS.map((bucket) => ({ ...bucket, count: 0 }));
  for (const score of scores) {
    const bucket = getScoreBucket(score);
    const target = distribution.find((item) => item.key === bucket.key);
    if (target) target.count += 1;
  }

  const maxBucketCount = Math.max(...distribution.map((bucket) => bucket.count), 1);

  return {
    scope: scope.key,
    scopeLabel: scope.label,
    attemptCount: attempts.length,
    participantCount: participantIds.size,
    averageScore: average(scores),
    bestScore: scores.length ? Math.max(...scores) : null,
    userBestScore,
    userLatestScore: comparisonScore,
    userRank: hasComparisonPeers ? userRank : null,
    percentile,
    distribution: distribution.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      count: bucket.count,
      percent: Math.round((bucket.count / maxBucketCount) * 100)
    }))
  };
}

async function fetchScopeRows(admin, scope, mode) {
  let query = admin
    .from("licenta_exam_attempts")
    .select("user_id, score_percent, created_at")
    .eq(scope.column, scope.id)
    .order("created_at", { ascending: false })
    .limit(RECENT_ATTEMPT_LIMIT);
  if (mode) query = query.eq("mode", mode);

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}

async function fetchDashboardScopeRows(admin, scope) {
  const { data, error } = await admin
    .from("licenta_exam_attempts")
    .select(
      "id, user_id, mode, score_percent, correct_count, question_count, wrong_count, unanswered_count, metadata, created_at"
    )
    .eq(scope.column, scope.id)
    .order("created_at", { ascending: false })
    .limit(RECENT_ATTEMPT_LIMIT);

  if (error) throw error;

  return data || [];
}

async function fetchPersonalRows(admin, userId) {
  const { data, error } = await admin
    .from("licenta_exam_attempts")
    .select(
      "id, user_id, mode, score_percent, correct_count, question_count, wrong_count, unanswered_count, metadata, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  return data || [];
}

function buildDistribution(attempts) {
  const distribution = SCORE_BUCKETS.map((bucket) => ({ ...bucket, count: 0 }));

  for (const attempt of attempts) {
    const bucket = getScoreBucket(attempt.scorePercent);
    const target = distribution.find((item) => item.key === bucket.key);
    if (target) target.count += 1;
  }

  const maxBucketCount = Math.max(...distribution.map((bucket) => bucket.count), 1);
  return distribution.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: bucket.count,
    percent: Math.round((bucket.count / maxBucketCount) * 100)
  }));
}

function buildModeBreakdown(attempts) {
  const byMode = new Map();

  for (const attempt of attempts) {
    const current = byMode.get(attempt.mode) || {
      key: attempt.mode,
      label: MODE_LABELS[attempt.mode] || attempt.mode,
      count: 0,
      scores: []
    };

    current.count += 1;
    current.scores.push(attempt.scorePercent);
    byMode.set(attempt.mode, current);
  }

  const total = attempts.length || 1;
  return Array.from(byMode.values())
    .map((item) => ({
      key: item.key,
      label: item.label,
      count: item.count,
      averageScore: average(item.scores),
      percent: Math.round((item.count / total) * 100)
    }))
    .sort((left, right) => right.count - left.count);
}

function buildSubjectWeaknessRows(attempts) {
  const subjects = new Map();

  for (const attempt of attempts) {
    const rows = Array.isArray(attempt.metadata?.subjectBreakdown)
      ? attempt.metadata.subjectBreakdown
      : [];

    for (const row of rows) {
      const subjectId = String(row.subjectId || row.title || "licenta").trim();
      const title = String(row.title || subjectId || "Licenta").trim();
      const current = subjects.get(subjectId) || {
        key: subjectId,
        title,
        total: 0,
        wrong: 0,
        correct: 0
      };

      current.total += Number(row.total || 0);
      current.wrong += Number(row.wrong || 0);
      current.correct += Number(row.correct || 0);
      subjects.set(subjectId, current);
    }
  }

  return Array.from(subjects.values())
    .filter((row) => row.total > 0)
    .map((row) => ({
      ...row,
      wrongPercent: Math.round((row.wrong / row.total) * 100),
      correctPercent: Math.round((row.correct / row.total) * 100)
    }))
    .sort((left, right) => right.wrongPercent - left.wrongPercent || right.wrong - left.wrong)
    .slice(0, 6);
}

function buildTrendRows(attempts) {
  return attempts
    .slice(0, 12)
    .reverse()
    .map((attempt, index) => ({
      key: attempt.id || `${attempt.createdAt}-${index}`,
      label: formatDateLabel(attempt.createdAt) || `R${index + 1}`,
      score: attempt.scorePercent,
      mode: MODE_LABELS[attempt.mode] || attempt.mode
    }));
}

function buildRankStats({ attempts, userId }) {
  const participantIds = new Set(attempts.map((attempt) => attempt.userId).filter(Boolean));
  const bestByUser = new Map();

  for (const attempt of attempts) {
    const currentBest = bestByUser.get(attempt.userId);
    if (currentBest === undefined || attempt.scorePercent > currentBest) {
      bestByUser.set(attempt.userId, attempt.scorePercent);
    }
  }

  const rankedBestScores = Array.from(bestByUser.entries()).sort((left, right) => right[1] - left[1]);
  const userRankIndex = rankedBestScores.findIndex(([rankedUserId]) => rankedUserId === userId);
  const userRank = participantIds.size > 1 && userRankIndex >= 0 ? userRankIndex + 1 : null;
  const userBestScore = bestByUser.get(userId) ?? null;
  const percentile =
    participantIds.size > 1 && userBestScore !== null
      ? Math.round(
          (rankedBestScores.filter(([, score]) => score <= userBestScore).length /
            rankedBestScores.length) *
            100
        )
      : null;

  return {
    participantCount: participantIds.size,
    userRank,
    userBestScore,
    percentile
  };
}

export async function buildLicentaExamCommunityStats({
  admin,
  academicContext,
  userId,
  scorePercent,
  mode
}) {
  const scopes = getStatsScopeCandidates(academicContext);
  if (!scopes.length) {
    return null;
  }

  let fallback = null;

  for (const scope of scopes) {
    const rows = await fetchScopeRows(admin, scope, mode);
    const participantCount = new Set(rows.map((row) => row.user_id).filter(Boolean)).size;
    const summary = summarizeRows(rows, { userId, scorePercent, scope });

    if (!fallback) {
      fallback = summary;
    }

    if (participantCount >= MIN_SCOPE_PARTICIPANTS) {
      return summary;
    }
  }

  return fallback;
}

export async function buildLicentaExamStatsDashboard({ admin, academicContext, userId }) {
  const scopes = getStatsScopeCandidates(academicContext);
  const personalRows = await fetchPersonalRows(admin, userId);
  const personalAttempts = personalRows.map(normalizeAttempt);
  let selectedScope = null;
  let selectedRows = [];
  let fallbackScope = null;
  let fallbackRows = [];

  for (const scope of scopes) {
    const rows = await fetchDashboardScopeRows(admin, scope);
    const participantCount = new Set(rows.map((row) => row.user_id).filter(Boolean)).size;

    if (!fallbackScope) {
      fallbackScope = scope;
      fallbackRows = rows;
    }

    if (participantCount >= MIN_SCOPE_PARTICIPANTS) {
      selectedScope = scope;
      selectedRows = rows;
      break;
    }
  }

  if (!selectedScope) {
    selectedScope = fallbackScope;
    selectedRows = fallbackRows;
  }

  const communityAttempts = selectedRows.map(normalizeAttempt);
  const personalCoreAttempts = personalAttempts.filter((attempt) =>
    ["quick", "custom"].includes(attempt.mode)
  );
  const communityCoreAttempts = communityAttempts.filter((attempt) =>
    ["quick", "custom"].includes(attempt.mode)
  );
  const personalScores = personalCoreAttempts.map((attempt) => attempt.scorePercent);
  const communityScores = communityCoreAttempts.map((attempt) => attempt.scorePercent);
  const latestAttempt = personalCoreAttempts[0] || null;
  const totals = personalAttempts.reduce(
    (acc, attempt) => {
      acc.correct += attempt.correctCount;
      acc.wrong += attempt.wrongCount;
      acc.unanswered += attempt.unansweredCount;
      acc.questions += attempt.questionCount;
      return acc;
    },
    { correct: 0, wrong: 0, unanswered: 0, questions: 0 }
  );
  const rankStats = buildRankStats({ attempts: communityCoreAttempts, userId });
  const activeDays = new Set(
    personalAttempts
      .map((attempt) => (attempt.createdAt ? attempt.createdAt.slice(0, 10) : ""))
      .filter(Boolean)
  ).size;

  return {
    scope: selectedScope?.key || "community",
    scopeLabel: selectedScope?.label || "comunitatea ta",
    overview: {
      personalAttemptCount: personalCoreAttempts.length,
      communityAttemptCount: communityCoreAttempts.length,
      participantCount: rankStats.participantCount,
      latestScore: latestAttempt?.scorePercent ?? null,
      bestScore: personalScores.length ? Math.max(...personalScores) : null,
      personalAverage: average(personalScores),
      communityAverage: average(communityScores),
      communityBest: communityScores.length ? Math.max(...communityScores) : null,
      userRank: rankStats.userRank,
      percentile: rankStats.percentile,
      activeDays,
      totalQuestions: totals.questions,
      totalCorrect: totals.correct,
      totalWrong: totals.wrong,
      totalUnanswered: totals.unanswered,
      accuracy: totals.questions ? Math.round((totals.correct / totals.questions) * 100) : 0
    },
    trend: buildTrendRows(personalAttempts),
    personalModeBreakdown: buildModeBreakdown(personalAttempts),
    communityModeBreakdown: buildModeBreakdown(communityAttempts),
    communityDistribution: buildDistribution(communityCoreAttempts),
    personalDistribution: buildDistribution(personalCoreAttempts),
    subjectWeaknessRows: buildSubjectWeaknessRows(personalAttempts)
  };
}
