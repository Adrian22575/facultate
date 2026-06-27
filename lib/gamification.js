import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerEnv } from "@/lib/env/server";
import { isSupabaseSetupIncompleteError } from "@/lib/supabase/setup-status";

export const GAMIFICATION_LEVELS = [
  {
    key: "incepator",
    title: "Incepator",
    minPoints: 0,
    badge: "1",
    unlockMessage: "Ai pornit progresul Nota 5+."
  },
  {
    key: "explorator",
    title: "Explorator",
    minPoints: 120,
    badge: "2",
    unlockMessage: "Ai prins ritmul primelor sesiuni."
  },
  {
    key: "student_ambitios",
    title: "Student ambitios",
    minPoints: 350,
    badge: "3",
    unlockMessage: "Inveti constant si se vede."
  },
  {
    key: "cunoscator",
    title: "Cunoscator",
    minPoints: 800,
    badge: "4",
    unlockMessage: "Ai deja o baza solida de raspunsuri."
  },
  {
    key: "strateg",
    title: "Strateg al invatarii",
    minPoints: 1500,
    badge: "5",
    unlockMessage: "Folosesti testele si greselile strategic."
  },
  {
    key: "expert",
    title: "Expert",
    minPoints: 2800,
    badge: "6",
    unlockMessage: "Ai un ritm avansat de pregatire."
  },
  {
    key: "maestru_grile",
    title: "Maestru al grilelor",
    minPoints: 5000,
    badge: "7",
    unlockMessage: "Stapanesti multe runde si simulari."
  },
  {
    key: "campion_nota5",
    title: "Campion Nota 5+",
    minPoints: 9000,
    badge: "8",
    unlockMessage: "Ai ajuns la nivelul cel mai greu."
  }
];

export const GAMIFICATION_ACHIEVEMENTS = [
  {
    key: "first_test",
    title: "Primul test finalizat",
    description: "Finalizeaza primul test sau prima simulare.",
    badge: "T1",
    bonusPoints: 30
  },
  {
    key: "questions_100",
    title: "100 de intrebari",
    description: "Raspunde la 100 de intrebari.",
    badge: "100",
    bonusPoints: 50
  },
  {
    key: "questions_500",
    title: "500 de intrebari",
    description: "Raspunde la 500 de intrebari.",
    badge: "500",
    bonusPoints: 120
  },
  {
    key: "streak_7",
    title: "7 zile la rand",
    description: "Invata 7 zile consecutive.",
    badge: "7Z",
    bonusPoints: 70
  },
  {
    key: "streak_30",
    title: "30 de zile la rand",
    description: "Invata 30 de zile consecutive.",
    badge: "30Z",
    bonusPoints: 250
  },
  {
    key: "first_80",
    title: "Peste 80%",
    description: "Obtine primul rezultat de cel putin 80%.",
    badge: "80%",
    bonusPoints: 40
  },
  {
    key: "first_100",
    title: "Runda perfecta",
    description: "Obtine primul rezultat de 100%.",
    badge: "100%",
    bonusPoints: 80
  },
  {
    key: "licenta_10",
    title: "10 simulari de licenta",
    description: "Finalizeaza 10 runde de licenta.",
    badge: "L10",
    bonusPoints: 150
  },
  {
    key: "correct_100",
    title: "100 de raspunsuri corecte",
    description: "Strange 100 de raspunsuri corecte.",
    badge: "C100",
    bonusPoints: 60
  },
  {
    key: "mistakes_fixed",
    title: "Invata din greseli",
    description: "Finalizeaza o runda dedicata greselilor.",
    badge: "G",
    bonusPoints: 50
  }
];

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

function clampInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

function getBucharestDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getLevelForPoints(totalPoints) {
  let current = GAMIFICATION_LEVELS[0];
  let next = null;

  for (const level of GAMIFICATION_LEVELS) {
    if (totalPoints >= level.minPoints) {
      current = level;
      continue;
    }
    next = level;
    break;
  }

  const nextPoints = next ? next.minPoints : current.minPoints;
  const levelSpan = Math.max(1, nextPoints - current.minPoints);
  const pointsIntoLevel = Math.max(0, totalPoints - current.minPoints);

  return {
    current,
    next,
    progressPercent: next ? Math.min(100, Math.round((pointsIntoLevel / levelSpan) * 100)) : 100,
    pointsToNext: next ? Math.max(0, next.minPoints - totalPoints) : 0
  };
}

function getNextStreakMilestone(currentStreak) {
  const next = STREAK_MILESTONES.find((milestone) => currentStreak < milestone) || null;
  return {
    next,
    daysToNext: next ? next - currentStreak : 0
  };
}

export function calculateGamificationAward({
  actionType,
  correctCount = 0,
  questionCount = 0,
  scorePercent = 0
}) {
  const safeCorrect = clampInteger(correctCount);
  const safeQuestions = clampInteger(questionCount);
  const safeScore = clampInteger(scorePercent);
  const perCorrect = safeCorrect * 4;
  let bonus = 0;

  if (actionType === "subject_test_completed") bonus += 20;
  if (actionType === "learning_quiz_completed") bonus += 20;
  if (actionType === "learning_mistakes_completed") bonus += 35;
  if (actionType === "licenta_simulation_completed") bonus += 60;
  if (actionType === "licenta_mistakes_completed") bonus += 45;

  if (safeScore >= 80) bonus += 15;
  if (safeScore === 100 && safeQuestions > 0) bonus += 30;

  return Math.min(1000, Math.max(1, perCorrect + bonus));
}

export function buildEmptyGamificationSummary() {
  const totalPoints = 0;
  const level = getLevelForPoints(totalPoints);
  const todayKey = getBucharestDateKey();
  const milestone = getNextStreakMilestone(0);

  return {
    available: false,
    totalPoints,
    currentStreak: 0,
    bestStreak: 0,
    lastActiveDate: null,
    todayCompleted: false,
    todayKey,
    level,
    milestone,
    todayMessage: "Finalizeaza un test astazi pentru a porni seria.",
    recentTransactions: [],
    achievements: GAMIFICATION_ACHIEVEMENTS.map((achievement) => ({
      ...achievement,
      unlocked: false,
      unlockedAt: null
    }))
  };
}

export async function awardGamificationPoints({
  userId,
  actionType,
  points,
  referenceType,
  referenceId,
  idempotencyKey,
  metadata = {}
}) {
  if (!userId || !actionType || !idempotencyKey || points < 1) {
    return null;
  }

  try {
    getSupabaseServerEnv();
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("award_gamification_points", {
      p_user_id: userId,
      p_action_type: actionType,
      p_points: points,
      p_reference_type: referenceType || null,
      p_reference_id: referenceId ? String(referenceId) : null,
      p_idempotency_key: idempotencyKey,
      p_metadata: metadata || {}
    });

    if (error) throw error;

    return normalizeGamificationAward(data);
  } catch (error) {
    if (isSupabaseSetupIncompleteError(error)) {
      return null;
    }

    console.error("gamification_award_failed", error);
    return null;
  }
}

function normalizeGamificationAward(data) {
  if (!data || typeof data !== "object") return null;
  return {
    created: Boolean(data.created),
    pointsAwarded: clampInteger(data.pointsAwarded),
    totalPoints: clampInteger(data.totalPoints),
    currentStreak: clampInteger(data.currentStreak),
    bestStreak: clampInteger(data.bestStreak),
    lastActiveDate: data.lastActiveDate || null,
    activityDate: data.activityDate || null,
    unlockedAchievements: Array.isArray(data.unlockedAchievements)
      ? data.unlockedAchievements.map((achievement) => ({
          key: String(achievement.key || ""),
          title: String(achievement.title || ""),
          bonusPoints: clampInteger(achievement.bonusPoints)
        })).filter((achievement) => achievement.key)
      : []
  };
}

export async function getGamificationSummary(userId) {
  if (!userId) return buildEmptyGamificationSummary();

  try {
    getSupabaseServerEnv();
    const admin = createAdminClient();
    const [
      { data: profile, error: profileError },
      { data: transactions, error: transactionsError },
      { data: unlockedRows, error: unlockedError }
    ] = await Promise.all([
      admin
        .from("gamification_profiles")
        .select("total_points,current_streak,best_streak,last_active_date,updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("gamification_point_transactions")
        .select("id,action_type,points,reference_type,reference_id,metadata,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
      admin
        .from("gamification_user_achievements")
        .select("achievement_key,unlocked_at,points_awarded")
        .eq("user_id", userId)
    ]);

    if (profileError && profileError.code !== "PGRST116") throw profileError;
    if (transactionsError) throw transactionsError;
    if (unlockedError) throw unlockedError;

    const totalPoints = clampInteger(profile?.total_points);
    const currentStreak = clampInteger(profile?.current_streak);
    const bestStreak = clampInteger(profile?.best_streak);
    const todayKey = getBucharestDateKey();
    const lastActiveDate = profile?.last_active_date || null;
    const todayCompleted = lastActiveDate === todayKey;
    const level = getLevelForPoints(totalPoints);
    const milestone = getNextStreakMilestone(currentStreak);
    const unlockedByKey = new Map(
      (unlockedRows || []).map((row) => [row.achievement_key, row])
    );

    return {
      available: true,
      totalPoints,
      currentStreak,
      bestStreak,
      lastActiveDate,
      todayCompleted,
      todayKey,
      level,
      milestone,
      todayMessage: todayCompleted
        ? "Activitatea de astazi este completata."
        : "Finalizeaza un test astazi pentru a-ti pastra seria.",
      recentTransactions: (transactions || []).map((row) => ({
        id: row.id,
        actionType: row.action_type,
        points: clampInteger(row.points),
        referenceType: row.reference_type || null,
        referenceId: row.reference_id || null,
        metadata: row.metadata || {},
        createdAt: row.created_at
      })),
      achievements: GAMIFICATION_ACHIEVEMENTS.map((achievement) => {
        const unlocked = unlockedByKey.get(achievement.key);
        return {
          ...achievement,
          unlocked: Boolean(unlocked),
          unlockedAt: unlocked?.unlocked_at || null,
          pointsAwarded: clampInteger(unlocked?.points_awarded, achievement.bonusPoints)
        };
      })
    };
  } catch (error) {
    if (isSupabaseSetupIncompleteError(error)) {
      return buildEmptyGamificationSummary();
    }

    console.error("gamification_summary_failed", error);
    return buildEmptyGamificationSummary();
  }
}
