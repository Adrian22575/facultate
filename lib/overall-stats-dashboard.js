import "server-only";

import {
  buildLicentaExamStatsDashboard,
  getStatsScopeCandidates
} from "@/lib/licenta-exam-community-stats";

const MIN_SCOPE_PARTICIPANTS = 3;

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function formatDateLabel(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short" }).format(new Date(value));
  } catch {
    return "";
  }
}

function getPeriodStart(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function isAfterDate(value, date) {
  if (!value) return false;
  return new Date(value).getTime() >= date.getTime();
}

function anonymizeProfile(profile, index, currentUserId) {
  if (profile?.id === currentUserId) {
    return "Tu";
  }

  const fullName = String(profile?.full_name || "").trim();
  if (!fullName) {
    return `Colegul ${index + 1}`;
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0];
  }

  return `${parts[0]} ${parts[1][0]}.`;
}

function getSubjectTitle(subjectMap, subjectId) {
  return subjectMap.get(subjectId)?.title || subjectId || "Materie";
}

function calculateProgressPercent(row) {
  const studyPercent =
    row.study_total_questions > 0
      ? Math.round((row.study_viewed_count / row.study_total_questions) * 100)
      : 0;
  const interactivePercent =
    row.interactive_total_questions > 0
      ? Math.round((row.interactive_answered / row.interactive_total_questions) * 100)
      : 0;
  const testPercent = row.test_best_score_percent || 0;

  return Math.max(studyPercent, interactivePercent, testPercent);
}

function normalizeSubjectProgress(row, subjectMap) {
  const studyTotal = Number(row.study_total_questions || 0);
  const studyViewed = Number(row.study_viewed_count || 0);
  const interactiveTotal = Number(row.interactive_total_questions || 0);
  const interactiveAnswered = Number(row.interactive_answered || 0);
  const interactiveCorrect = Number(row.interactive_correct || 0);
  const interactiveWrong = Number(row.interactive_wrong || 0);
  const bestTestScore = Number(row.test_best_score_percent || 0);
  const lastTestScore = Number(row.test_last_score_percent || 0);

  return {
    userId: row.user_id,
    subjectId: row.subject_id,
    title: getSubjectTitle(subjectMap, row.subject_id),
    progressPercent: calculateProgressPercent(row),
    studyTotal,
    studyViewed,
    interactiveTotal,
    interactiveAnswered,
    interactiveCorrect,
    interactiveWrong,
    bestTestScore,
    lastTestScore,
    lastMode: row.last_mode || null,
    lastActivityAt: row.last_activity_at || null
  };
}

async function fetchSubjects(admin) {
  const { data, error } = await admin.from("subjects").select("id, title").order("title");
  if (error) throw error;

  return new Map((data || []).map((subject) => [subject.id, subject]));
}

async function fetchPersonalSubjectRows(admin, userId) {
  const { data, error } = await admin
    .from("subject_progress")
    .select(
      "user_id, subject_id, study_total_questions, study_viewed_count, interactive_total_questions, interactive_answered, interactive_correct, interactive_wrong, test_best_score_percent, test_last_score_percent, last_mode, last_activity_at"
    )
    .eq("user_id", userId)
    .order("last_activity_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return data || [];
}

async function fetchCommunityUserIds(admin, scope) {
  if (!scope) return [];
  const membershipColumn =
    scope.key === "program"
      ? "program_unit_id"
      : scope.key === "cohort"
        ? "cohort_id"
        : "institution_id";

  const { data, error } = await admin
    .from("memberships")
    .select("user_id")
    .eq(membershipColumn, scope.id)
    .eq("status", "active")
    .limit(1000);

  if (error) throw error;

  return Array.from(new Set((data || []).map((row) => row.user_id).filter(Boolean)));
}

async function fetchCommunitySubjectRows(admin, userIds) {
  if (!userIds.length) return [];

  const { data, error } = await admin
    .from("subject_progress")
    .select(
      "user_id, subject_id, study_total_questions, study_viewed_count, interactive_total_questions, interactive_answered, interactive_correct, interactive_wrong, test_best_score_percent, test_last_score_percent, last_mode, last_activity_at"
    )
    .in("user_id", userIds.slice(0, 1000))
    .order("last_activity_at", { ascending: false })
    .limit(5000);

  if (error) throw error;
  return data || [];
}

async function fetchCommunityProfiles(admin, userIds) {
  if (!userIds.length) return new Map();

  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds.slice(0, 1000));

  if (error) throw error;

  return new Map((data || []).map((profile) => [profile.id, profile]));
}

async function fetchCommunityLicentaAttempts(admin, userIds) {
  if (!userIds.length) return [];

  const { data, error } = await admin
    .from("licenta_exam_attempts")
    .select("user_id, score_percent, question_count, created_at")
    .in("user_id", userIds.slice(0, 1000))
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) throw error;

  return data || [];
}

async function pickCommunitySubjectScope(admin, academicContext) {
  const scopes = getStatsScopeCandidates(academicContext);
  let fallback = null;

  for (const scope of scopes) {
    const userIds = await fetchCommunityUserIds(admin, scope);
    const current = { scope, userIds };

    if (!fallback) {
      fallback = current;
    }

    if (userIds.length >= MIN_SCOPE_PARTICIPANTS) {
      return current;
    }
  }

  return fallback || { scope: null, userIds: [] };
}

function buildModeMix(rows) {
  const modes = [
    { key: "study", label: "Studiu", count: rows.filter((row) => row.studyViewed > 0).length },
    {
      key: "interactive",
      label: "Interactiv",
      count: rows.filter((row) => row.interactiveAnswered > 0).length
    },
    { key: "test", label: "Teste", count: rows.filter((row) => row.bestTestScore > 0).length }
  ];
  const total = Math.max(modes.reduce((sum, row) => sum + row.count, 0), 1);

  return modes.map((row) => ({
    ...row,
    percent: Math.round((row.count / total) * 100)
  }));
}

function buildSubjectRows(personalRows, communityRows) {
  const communityBySubject = new Map();

  for (const row of communityRows) {
    const current = communityBySubject.get(row.subjectId) || { scores: [], progress: [] };
    if (row.bestTestScore > 0) current.scores.push(row.bestTestScore);
    if (row.progressPercent > 0) current.progress.push(row.progressPercent);
    communityBySubject.set(row.subjectId, current);
  }

  return personalRows
    .map((row) => {
      const community = communityBySubject.get(row.subjectId) || { scores: [], progress: [] };

      return {
        key: row.subjectId,
        title: row.title,
        progressPercent: row.progressPercent,
        bestTestScore: row.bestTestScore,
        lastTestScore: row.lastTestScore,
        interactiveAccuracy: row.interactiveAnswered
          ? Math.round((row.interactiveCorrect / row.interactiveAnswered) * 100)
          : 0,
        studied: row.studyViewed,
        answered: row.interactiveAnswered,
        wrong: row.interactiveWrong,
        communityAverageTest: average(community.scores),
        communityAverageProgress: average(community.progress),
        lastMode: row.lastMode,
        lastActivityLabel: formatDateLabel(row.lastActivityAt)
      };
    })
    .sort((left, right) => right.progressPercent - left.progressPercent)
    .slice(0, 8);
}

function buildSubjectTrend(rows) {
  return rows
    .filter((row) => row.progressPercent > 0)
    .slice(0, 10)
    .reverse()
    .map((row, index) => ({
      key: `${row.subjectId}-${row.lastActivityAt || index}`,
      label: row.lastActivityLabel || `M${index + 1}`,
      score: row.progressPercent,
      mode: row.title
    }));
}

function buildSubjectStats({ personalRows, communityRows, communityScope }) {
  const personalScores = personalRows.map((row) => row.bestTestScore).filter((score) => score > 0);
  const communityScores = communityRows.map((row) => row.bestTestScore).filter((score) => score > 0);
  const totals = personalRows.reduce(
    (acc, row) => {
      acc.studyViewed += row.studyViewed;
      acc.studyTotal += row.studyTotal;
      acc.interactiveAnswered += row.interactiveAnswered;
      acc.interactiveCorrect += row.interactiveCorrect;
      acc.interactiveWrong += row.interactiveWrong;
      return acc;
    },
    {
      studyViewed: 0,
      studyTotal: 0,
      interactiveAnswered: 0,
      interactiveCorrect: 0,
      interactiveWrong: 0
    }
  );
  const participantCount = new Set(communityRows.map((row) => row.userId).filter(Boolean)).size;

  return {
    scopeLabel: communityScope?.label || "comunitatea ta",
    overview: {
      subjectCount: personalRows.length,
      activeSubjectCount: personalRows.filter((row) => row.progressPercent > 0).length,
      personalAverageProgress: average(personalRows.map((row) => row.progressPercent)),
      communityAverageProgress: average(communityRows.map((row) => row.progressPercent)),
      personalAverageTest: average(personalScores),
      communityAverageTest: average(communityScores),
      bestSubjectScore: personalScores.length ? Math.max(...personalScores) : null,
      studiedQuestions: totals.studyViewed,
      studyTotal: totals.studyTotal,
      interactiveAnswered: totals.interactiveAnswered,
      interactiveAccuracy: totals.interactiveAnswered
        ? Math.round((totals.interactiveCorrect / totals.interactiveAnswered) * 100)
        : 0,
      interactiveWrong: totals.interactiveWrong,
      participantCount
    },
    rows: buildSubjectRows(personalRows, communityRows),
    modeMix: buildModeMix(personalRows),
    trend: buildSubjectTrend(personalRows)
  };
}

function createCompetitionUser(profileMap, userId, index, currentUserId) {
  return {
    userId,
    label: anonymizeProfile(profileMap.get(userId), index, currentUserId),
    isCurrentUser: userId === currentUserId,
    effort: 0,
    weekEffort: 0,
    monthEffort: 0,
    scoreParts: [],
    weekScoreParts: [],
    monthScoreParts: [],
    licentaAttempts: 0,
    subjectActions: 0
  };
}

function getCompetitionUser(users, profileMap, userId, currentUserId) {
  if (!users.has(userId)) {
    users.set(userId, createCompetitionUser(profileMap, userId, users.size, currentUserId));
  }

  return users.get(userId);
}

function buildLeaderboard(users, periodKey, limit = 5) {
  return Array.from(users.values())
    .map((user) => {
      const scoreParts = user[`${periodKey}ScoreParts`] || [];
      const effort = user[`${periodKey}Effort`] || 0;
      return {
        userId: user.userId,
        label: user.label,
        isCurrentUser: user.isCurrentUser,
        effort,
        averageScore: average(scoreParts),
        activityLabel: `${effort} intrebari`
      };
    })
    .filter((user) => user.effort > 0 || user.averageScore > 0)
    .sort((left, right) => right.effort - left.effort || right.averageScore - left.averageScore)
    .slice(0, limit)
    .map((user, index) => ({ ...user, rank: index + 1 }));
}

function getRank(rows, userId) {
  const index = rows.findIndex((row) => row.userId === userId);
  return index >= 0 ? index + 1 : null;
}

function buildCompetitionStats({ userIds, currentUserId, profileMap, subjectRows, licentaAttempts }) {
  const users = new Map();
  const weekStart = getPeriodStart(7);
  const monthStart = getPeriodStart(30);

  for (const userId of userIds) {
    getCompetitionUser(users, profileMap, userId, currentUserId);
  }

  for (const row of subjectRows) {
    const user = getCompetitionUser(users, profileMap, row.userId, currentUserId);
    const effort = row.studyViewed + row.interactiveAnswered;
    const scoreParts = [
      row.bestTestScore,
      row.interactiveAnswered ? Math.round((row.interactiveCorrect / row.interactiveAnswered) * 100) : 0
    ].filter((score) => score > 0);

    user.effort += effort;
    user.subjectActions += effort;
    user.scoreParts.push(...scoreParts);

    if (isAfterDate(row.lastActivityAt, weekStart)) {
      user.weekEffort += effort;
      user.weekScoreParts.push(...scoreParts);
    }

    if (isAfterDate(row.lastActivityAt, monthStart)) {
      user.monthEffort += effort;
      user.monthScoreParts.push(...scoreParts);
    }
  }

  for (const attempt of licentaAttempts) {
    const user = getCompetitionUser(users, profileMap, attempt.user_id, currentUserId);
    const effort = Number(attempt.question_count || 0);
    const score = Number(attempt.score_percent || 0);

    user.effort += effort;
    user.licentaAttempts += 1;
    if (score > 0) user.scoreParts.push(score);

    if (isAfterDate(attempt.created_at, weekStart)) {
      user.weekEffort += effort;
      if (score > 0) user.weekScoreParts.push(score);
    }

    if (isAfterDate(attempt.created_at, monthStart)) {
      user.monthEffort += effort;
      if (score > 0) user.monthScoreParts.push(score);
    }
  }

  const allUsers = Array.from(users.values());
  const currentUser = users.get(currentUserId) || createCompetitionUser(profileMap, currentUserId, users.size, currentUserId);
  const others = allUsers.filter((user) => user.userId !== currentUserId);
  const overallRows = allUsers
    .map((user) => ({
      userId: user.userId,
      label: user.label,
      isCurrentUser: user.isCurrentUser,
      effort: user.effort,
      averageScore: average(user.scoreParts)
    }))
    .sort((left, right) => right.effort - left.effort || right.averageScore - left.averageScore);
  const topWeek = buildLeaderboard(users, "week");
  const topMonth = buildLeaderboard(users, "month");

  return {
    participantCount: allUsers.length,
    currentUser: {
      effort: currentUser.effort,
      weekEffort: currentUser.weekEffort,
      monthEffort: currentUser.monthEffort,
      averageScore: average(currentUser.scoreParts),
      weekAverageScore: average(currentUser.weekScoreParts),
      monthAverageScore: average(currentUser.monthScoreParts),
      rankByEffort: getRank(overallRows, currentUserId),
      weekRank: getRank(topWeek, currentUserId),
      monthRank: getRank(topMonth, currentUserId)
    },
    community: {
      averageEffort: average(others.map((user) => user.effort)),
      weekAverageEffort: average(others.map((user) => user.weekEffort)),
      monthAverageEffort: average(others.map((user) => user.monthEffort)),
      averageScore: average(others.map((user) => average(user.scoreParts)).filter((score) => score > 0)),
      weekAverageScore: average(others.map((user) => average(user.weekScoreParts)).filter((score) => score > 0)),
      monthAverageScore: average(others.map((user) => average(user.monthScoreParts)).filter((score) => score > 0))
    },
    topWeek,
    topMonth,
    topOverall: overallRows.slice(0, 5).map((user, index) => ({ ...user, rank: index + 1 }))
  };
}

export async function buildOverallStatsDashboard({ admin, academicContext, userId }) {
  const [licenta, subjectMap, personalSubjectRows, subjectScopeData] = await Promise.all([
    buildLicentaExamStatsDashboard({ admin, academicContext, userId }),
    fetchSubjects(admin),
    fetchPersonalSubjectRows(admin, userId),
    pickCommunitySubjectScope(admin, academicContext)
  ]);
  const communityUserIds = Array.from(new Set([...subjectScopeData.userIds, userId]));
  const [communitySubjectRows, profileMap, communityLicentaAttempts] = await Promise.all([
    fetchCommunitySubjectRows(admin, communityUserIds),
    fetchCommunityProfiles(admin, communityUserIds),
    fetchCommunityLicentaAttempts(admin, communityUserIds)
  ]);
  const personalSubjects = personalSubjectRows.map((row) => normalizeSubjectProgress(row, subjectMap));
  const communitySubjects = communitySubjectRows.map((row) => normalizeSubjectProgress(row, subjectMap));
  const competition = buildCompetitionStats({
    userIds: communityUserIds,
    currentUserId: userId,
    profileMap,
    subjectRows: communitySubjects,
    licentaAttempts: communityLicentaAttempts
  });
  const subjects = buildSubjectStats({
    personalRows: personalSubjects,
    communityRows: communitySubjects,
    communityScope: subjectScopeData.scope
  });
  const overall = {
    totalActions:
      licenta.overview.personalAttemptCount +
      subjects.overview.studiedQuestions +
      subjects.overview.interactiveAnswered,
    activeAreas: [
      licenta.overview.personalAttemptCount > 0,
      subjects.overview.activeSubjectCount > 0
    ].filter(Boolean).length,
    averageScore: average(
      [
        licenta.overview.personalAverage,
        subjects.overview.personalAverageTest,
        subjects.overview.interactiveAccuracy
      ].filter((score) => score > 0)
    ),
    communityAverageScore: average(
      [
        licenta.overview.communityAverage,
        subjects.overview.communityAverageTest
      ].filter((score) => score > 0)
    )
  };

  return {
    scopeLabel: licenta.scopeLabel || subjects.scopeLabel || "comunitatea ta",
    overall,
    licenta,
    subjects,
    competition,
    learning: {
      status: "planned",
      title: "Invatare pe materii",
      description:
        "Cand modulul de invatare va fi activ, aici vom separa recapitularea, flashcards, planul de invatare si zonele slabe."
    }
  };
}
