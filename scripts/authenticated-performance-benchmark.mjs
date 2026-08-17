process.env.PERFORMANCE_SERVER_TIMING ||= process.argv.includes("--timing") ? "1" : "0";

const [
  { getAcademicContext },
  { getAdminHeaderActionSummary },
  { getBillingSnapshot },
  { getLicentaExamAvailability, getSubjectLibraryForUser },
  { getGamificationSummary },
  { buildOverallStatsDashboard },
  { getPrivateGeneratedTests },
  { getReferralDashboard, getReferralInvitationForUser },
  { createAdminClient },
  { getUserTestimonialRewardStatus }
] = await Promise.all([
  import("@/lib/academic/server.js"),
  import("@/lib/admin-center.js"),
  import("@/lib/billing.js"),
  import("@/lib/data.js"),
  import("@/lib/gamification.js"),
  import("@/lib/overall-stats-dashboard.js"),
  import("@/lib/private-tests.js"),
  import("@/lib/referrals.js"),
  import("@/lib/supabase/admin.js"),
  import("@/lib/testimonial-rewards.js")
]);

const runsArgument = process.argv.find((argument) => argument.startsWith("--runs="));
const runs = Math.max(1, Math.min(10, Number(runsArgument?.split("=")[1] || 3) || 3));
const admin = createAdminClient();

async function getFixtures() {
  const { data: adminFixture, error: adminError } = await admin
    .from("admin_users")
    .select("user_id, email")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (adminError || !adminFixture?.user_id) {
    throw adminError || new Error("Nu exista un fixture Admin activ.");
  }

  const { data: memberships, error: membershipError } = await admin
    .from("memberships")
    .select("user_id")
    .eq("status", "active")
    .neq("user_id", adminFixture.user_id)
    .limit(20);

  if (membershipError) {
    throw membershipError;
  }

  const normalIds = (memberships || []).map((row) => row.user_id).filter(Boolean);
  const { data: normalProfiles, error: profileError } = normalIds.length
    ? await admin.from("profiles").select("id, email").in("id", normalIds).limit(1)
    : { data: [], error: null };

  if (profileError || !normalProfiles?.[0]) {
    throw profileError || new Error("Nu exista un fixture normal cu membership activ.");
  }

  return {
    admin: { id: adminFixture.user_id, email: adminFixture.email, role: "admin" },
    normal: { id: normalProfiles[0].id, email: normalProfiles[0].email, role: "normal" }
  };
}

async function verifyAdminFixture(user) {
  if (user.role !== "admin") return false;

  const { data, error } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("email", user.email)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.user_id);
}

async function loadHeader(user, {
  isAdminKnown,
  billingSnapshot,
  gamificationSummary
} = {}) {
  const isAdmin = isAdminKnown ?? await verifyAdminFixture(user);
  await Promise.all([
    billingSnapshot === undefined ? getBillingSnapshot(user.id) : billingSnapshot,
    gamificationSummary === undefined ? getGamificationSummary(user.id) : gamificationSummary,
    isAdmin ? getAdminHeaderActionSummary(user.id) : null
  ]);
}

async function loadHome(user) {
  const adminStatePromise = verifyAdminFixture(user);
  const academicContext = await getAcademicContext(user.id);
  const userType = academicContext?.profile?.user_type === "elev" ? "elev" : "student";
  const adminActionCountPromise = adminStatePromise.then((isAdmin) =>
    isAdmin ? getAdminHeaderActionSummary(user.id) : null
  );

  await Promise.all([
    getSubjectLibraryForUser({
      userId: user.id,
      membership: academicContext?.membership,
      userType
    }),
    getLicentaExamAvailability({
      userId: user.id,
      membership: academicContext?.membership
    }),
    getBillingSnapshot(user.id),
    getGamificationSummary(user.id),
    adminStatePromise,
    adminActionCountPromise
  ]);
}

async function loadAccount(user) {
  const isAdmin = await verifyAdminFixture(user);
  await getAcademicContext(user.id);
  const [billingSnapshot] = await Promise.all([
    getBillingSnapshot(user.id),
    getReferralDashboard(user.id),
    getReferralInvitationForUser(user.id),
    getUserTestimonialRewardStatus(user.id)
  ]);
  await loadHeader(user, { isAdminKnown: isAdmin, billingSnapshot });
}

async function loadTests(user) {
  const academicContextPromise = getAcademicContext(user.id);
  await Promise.all([
    academicContextPromise,
    getPrivateGeneratedTests(user.id, { academicContextPromise })
  ]);
  await loadHeader(user);
}

async function loadProgress(user) {
  await getAcademicContext(user.id);
  const gamificationSummary = await getGamificationSummary(user.id);
  await loadHeader(user, { gamificationSummary });
}

async function loadStats(user) {
  const academicContext = await getAcademicContext(user.id);
  await buildOverallStatsDashboard({
    admin: createAdminClient(),
    academicContext,
    userId: user.id
  });
  await loadHeader(user);
}

const routeLoaders = new Map([
  ["/", loadHome],
  ["/cont", loadAccount],
  ["/testele-mele", loadTests],
  ["/progresul-meu", loadProgress],
  ["/statistici", loadStats]
]);

function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    medianMs: sorted[Math.floor(sorted.length / 2)],
    minMs: sorted[0],
    maxMs: sorted.at(-1),
    runs: values
  };
}

const fixtures = await getFixtures();
const results = {};

for (const [role, fixture] of Object.entries(fixtures)) {
  results[role] = {};

  for (const [route, loader] of routeLoaders) {
    const values = [];

    for (let index = 0; index < runs; index += 1) {
      const startedAt = performance.now();
      await loader(fixture);
      values.push(Math.round((performance.now() - startedAt) * 10) / 10);
    }

    results[role][route] = summarize(values);
    const routeMetric = route === "/" ? "home" : route.replace(/\W+/g, "_");
    console.log(`Server-Timing: route_${role}_${routeMetric};dur=${results[role][route].medianMs}`);
  }
}

console.log(JSON.stringify({ runs, results }, null, 2));
