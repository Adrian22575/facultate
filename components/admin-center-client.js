"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  ClipboardList,
  CreditCard,
  GraduationCap,
  KeyRound,
  Lightbulb,
  MessageSquareText,
  MonitorSmartphone,
  MousePointerClick,
  ReceiptText,
  Route,
  School,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Users,
  XCircle
} from "lucide-react";
import { AdminTabsContainer } from "@/components/admin-tabs-container";
import { LoadingIconText } from "@/components/loading-spinner";
import { markAdminNotificationViewed } from "@/lib/admin-notification-client";
import { ADMIN_NOTIFICATION_SCOPES } from "@/lib/admin-notification-scopes";

const PAGE_SIZE = 10;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parsePositivePage(value, fallback = 1) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAdminStateFromSource(source = {}) {
  const sectionParam = source.section;
  const section =
    sectionParam === "billing"
      ? "billing"
      : sectionParam === "users"
        ? "users"
        : sectionParam === "subjects"
          ? "subjects"
          : sectionParam === "academic"
            ? "academic"
            : sectionParam === "free-access"
              ? "free-access"
              : sectionParam === "testimonials"
                ? "testimonials"
                : sectionParam === "analytics"
                  ? "analytics"
                  : "feedback";

  return {
    section,
    feedbackFilter:
      source.feedback === "problem" || source.feedback === "feature" || source.feedback === "idea"
        ? source.feedback
        : "all",
    billingFilter:
      source.billing === "premium" ||
      source.billing === "credits" ||
      source.billing === "webhooks"
        ? source.billing
        : "all",
    usersFilter:
      source.users === "students" ||
      source.users === "elevi" ||
      source.users === "completed" ||
      source.users === "incomplete"
        ? source.users
        : "all",
    subjectsFilter:
      source.subjects === "student" ||
      source.subjects === "elev" ||
      source.subjects === "unassigned"
        ? source.subjects
        : "all",
    academicSubtab: source.academic_tab === "faculties" ? "faculties" : "institutions",
    feedbackSearch: source.feedback_q || "",
    billingSearch: source.billing_q || "",
    usersSearch: source.users_q || "",
    subjectsSearch: source.subjects_q || "",
    institutionsSearch: source.institutions_q || "",
    facultiesSearch: source.faculties_q || "",
    freeAccessSearch: source.free_access_q || "",
    testimonialsSearch: source.testimonials_q || "",
    testimonialsFilter:
      source.testimonials === "pending" ||
      source.testimonials === "approved" ||
      source.testimonials === "rejected"
        ? source.testimonials
        : "all",
    facultyInstitution: source.faculty_institution || "",
    feedbackPage: parsePositivePage(source.feedback_page),
    usersPage: parsePositivePage(source.users_page),
    subjectsPage: parsePositivePage(source.subjects_page),
    institutionsPage: parsePositivePage(source.institutions_page),
    facultiesPage: parsePositivePage(source.faculties_page),
    premiumPage: parsePositivePage(source.premium_page),
    creditsPage: parsePositivePage(source.credits_page),
    webhooksPage: parsePositivePage(source.webhooks_page),
    freeAccessPage: parsePositivePage(source.free_access_page),
    testimonialsPage: parsePositivePage(source.testimonials_page)
  };
}

function parseAdminStateFromUrl() {
  return parseAdminStateFromSource(Object.fromEntries(new URLSearchParams(window.location.search).entries()));
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function feedbackTypeLabel(value) {
  if (value === "problem") {
    return "Problema";
  }

  if (value === "feature") {
    return "Cerinta noua";
  }

  return "Idee";
}

function testimonialRewardLabel(value) {
  return value === "premium_24h" ? "24h premium" : "Incarcare gratuita";
}

function userTypeLabel(value) {
  return value === "elev" ? "Elev" : "Student";
}

function FilterButton({ active, onClick, children, icon: Icon = null, count = null, actionCount = 0 }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`btn-link secondary admin-filter-chip ${active ? "is-active-filter" : ""} ${actionCount > 0 ? "has-admin-action" : ""}`}
      onClick={onClick}
    >
      <span className="admin-tab-content">
        {Icon ? <Icon className="admin-tab-icon" aria-hidden="true" size={15} strokeWidth={2.2} /> : null}
        <span className="admin-tab-label">{children}</span>
        {Number.isFinite(count) ? <span className="admin-tab-count">{count}</span> : null}
        {actionCount > 0 ? <span className="admin-tab-action-count">{actionCount}</span> : null}
      </span>
    </button>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="admin-search-input"
      placeholder={placeholder}
      aria-label={placeholder}
    />
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="workspace-context-summary">
      <strong>{title}</strong>
      {subtitle ? <span>{subtitle}</span> : null}
    </div>
  );
}

function CellPill({ children, tone = "default" }) {
  return (
    <span className={`admin-table-pill ${tone !== "default" ? `is-${tone}` : ""}`}>{children}</span>
  );
}

function ReviewDot({ show, label = "De verificat" }) {
  if (!show) {
    return null;
  }

  return <span className="admin-review-dot" title={label} aria-label={label} />;
}

function TableSection({ title, subtitle, count, actions = null, children, variant = "boxed" }) {
  return (
    <section className={`admin-table-section ${variant === "flat" ? "admin-table-section--flat" : ""}`}>
      <div className="admin-table-section-head">
        <div>
          <h3>{title}</h3>
          <p className="page-copy">{subtitle}</p>
        </div>
        <div className="admin-table-head-actions">
          <span className="status-pill is-muted">{count}</span>
          {actions}
        </div>
      </div>
      {children}
    </section>
  );
}

function AdminTable({ columns, children, minWidth = 960 }) {
  return (
    <div className="table-scroll admin-table-scroll">
      <table className="admin-table" style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.align === "center" ? "table-center" : undefined}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function paginateRows(rows, page) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;

  return {
    rows: rows.slice(start, start + PAGE_SIZE),
    page: safePage,
    totalPages
  };
}

function PaginationControls({ page, totalPages, onChange }) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="admin-pagination">
      <button
        type="button"
        className="btn-link secondary admin-pagination-btn"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        Inapoi
      </button>
      <span className="admin-pagination-label">{`Pagina ${page} din ${totalPages}`}</span>
      <button
        type="button"
        className="btn-link secondary admin-pagination-btn"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        Inainte
      </button>
    </div>
  );
}

function matchesSearch(target, query) {
  return normalizeText(target).includes(normalizeText(query));
}

function TableDate({ value }) {
  return <span className="admin-table-date-cell">{formatDate(value)}</span>;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ro-RO").format(Number(value || 0));
}

function formatDurationMs(value) {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function formatUsageLabel(value) {
  if (!value) {
    return "-";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function learningStatusTone(status) {
  if (status === "ready") return "good";
  if (status === "ready_with_warnings") return "warning";
  if (status === "failed") return "danger";
  return "default";
}

function AnalyticsKpi({ icon: Icon, label, value, hint }) {
  return (
    <article className="admin-analytics-kpi">
      <span className="admin-analytics-kpi-icon">
        <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="admin-analytics-kpi-label">{label}</span>
      <strong>{formatNumber(value)}</strong>
      {hint ? <span className="admin-analytics-kpi-hint">{hint}</span> : null}
    </article>
  );
}

function AnalyticsList({ rows = [], emptyLabel = "Nu exista date inca." }) {
  const maxCount = Math.max(...rows.map((row) => row.count || 0), 1);

  if (!rows.length) {
    return <EmptyState title={emptyLabel} subtitle="Datele apar dupa ce utilizatorii folosesc aplicatia." />;
  }

  return (
    <div className="admin-analytics-list">
      {rows.map((row) => {
        const width = `${Math.max(8, Math.round(((row.count || 0) / maxCount) * 100))}%`;

        return (
          <div className="admin-analytics-row" key={row.key}>
            <div className="admin-analytics-row-main">
              <span>{formatUsageLabel(row.label || row.key)}</span>
              <strong>{formatNumber(row.count)}</strong>
            </div>
            <span className="admin-analytics-meter" aria-hidden="true">
              <span style={{ width }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AdminCenterClient({
  initialQuery = {},
  feedbackEntries,
  billingData,
  usersData,
  subjectsData,
  academicData,
  freeAccessData,
  testimonialRewardEntries = [],
  usageAnalytics = null,
  learningAnalytics = null,
  adminActionSummary = {},
  currentAdminUserId = ""
}) {
  const initialState = useMemo(() => parseAdminStateFromSource(initialQuery), [initialQuery]);

  const [section, setSection] = useState(initialState.section);
  const [feedbackFilter, setFeedbackFilter] = useState(initialState.feedbackFilter);
  const [billingFilter, setBillingFilter] = useState(initialState.billingFilter);
  const [usersFilter, setUsersFilter] = useState(initialState.usersFilter);
  const [subjectsFilter, setSubjectsFilter] = useState(initialState.subjectsFilter);
  const [testimonialsFilter, setTestimonialsFilter] = useState(initialState.testimonialsFilter);
  const [academicSubtab, setAcademicSubtab] = useState(initialState.academicSubtab);
  const [feedbackSearch, setFeedbackSearch] = useState(initialState.feedbackSearch);
  const [billingSearch, setBillingSearch] = useState(initialState.billingSearch);
  const [usersSearch, setUsersSearch] = useState(initialState.usersSearch);
  const [subjectsSearch, setSubjectsSearch] = useState(initialState.subjectsSearch);
  const [institutionsSearch, setInstitutionsSearch] = useState(initialState.institutionsSearch);
  const [facultiesSearch, setFacultiesSearch] = useState(initialState.facultiesSearch);
  const [freeAccessSearch, setFreeAccessSearch] = useState(initialState.freeAccessSearch);
  const [testimonialsSearch, setTestimonialsSearch] = useState(initialState.testimonialsSearch);
  const [facultyInstitution, setFacultyInstitution] = useState(initialState.facultyInstitution);
  const [feedbackPage, setFeedbackPage] = useState(initialState.feedbackPage);
  const [usersPage, setUsersPage] = useState(initialState.usersPage);
  const [subjectsPage, setSubjectsPage] = useState(initialState.subjectsPage);
  const [institutionsPage, setInstitutionsPage] = useState(initialState.institutionsPage);
  const [facultiesPage, setFacultiesPage] = useState(initialState.facultiesPage);
  const [premiumPage, setPremiumPage] = useState(initialState.premiumPage);
  const [creditsPage, setCreditsPage] = useState(initialState.creditsPage);
  const [webhooksPage, setWebhooksPage] = useState(initialState.webhooksPage);
  const [freeAccessPage, setFreeAccessPage] = useState(initialState.freeAccessPage);
  const [testimonialsPage, setTestimonialsPage] = useState(initialState.testimonialsPage);
  const [freeAccessRows, setFreeAccessRows] = useState(freeAccessData.rows || []);
  const [userRows, setUserRows] = useState(usersData || []);
  const [learningRows, setLearningRows] = useState(learningAnalytics?.recentStudySets || []);
  const [testimonialRows, setTestimonialRows] = useState(testimonialRewardEntries || []);
  const [freeAccessInput, setFreeAccessInput] = useState("");
  const [freeAccessNotes, setFreeAccessNotes] = useState("");
  const [freeAccessError, setFreeAccessError] = useState("");
  const [freeAccessSuccess, setFreeAccessSuccess] = useState("");
  const [isSubmittingFreeAccess, setIsSubmittingFreeAccess] = useState(false);
  const [testimonialActionError, setTestimonialActionError] = useState("");
  const [testimonialActionSuccess, setTestimonialActionSuccess] = useState("");
  const [updatingTestimonialId, setUpdatingTestimonialId] = useState("");
  const [userActionError, setUserActionError] = useState("");
  const [userActionSuccess, setUserActionSuccess] = useState("");
  const [deletingUserId, setDeletingUserId] = useState("");
  const [depublishingStudySetId, setDepublishingStudySetId] = useState("");
  const [learningActionMessage, setLearningActionMessage] = useState("");
  const [visibleAdminActionSummary, setVisibleAdminActionSummary] = useState(adminActionSummary);

  useEffect(() => {
    setVisibleAdminActionSummary(adminActionSummary);
  }, [adminActionSummary]);

  useEffect(() => {
    function syncFromUrl() {
      const next = parseAdminStateFromUrl();
      setSection(next.section);
      setFeedbackFilter(next.feedbackFilter);
      setBillingFilter(next.billingFilter);
      setUsersFilter(next.usersFilter);
      setSubjectsFilter(next.subjectsFilter);
      setTestimonialsFilter(next.testimonialsFilter);
      setAcademicSubtab(next.academicSubtab);
      setFeedbackSearch(next.feedbackSearch);
      setBillingSearch(next.billingSearch);
      setUsersSearch(next.usersSearch);
      setSubjectsSearch(next.subjectsSearch);
      setInstitutionsSearch(next.institutionsSearch);
      setFacultiesSearch(next.facultiesSearch);
      setFreeAccessSearch(next.freeAccessSearch);
      setTestimonialsSearch(next.testimonialsSearch);
      setFacultyInstitution(next.facultyInstitution);
      setFeedbackPage(next.feedbackPage);
      setUsersPage(next.usersPage);
      setSubjectsPage(next.subjectsPage);
      setInstitutionsPage(next.institutionsPage);
      setFacultiesPage(next.facultiesPage);
      setPremiumPage(next.premiumPage);
      setCreditsPage(next.creditsPage);
      setWebhooksPage(next.webhooksPage);
      setFreeAccessPage(next.freeAccessPage);
      setTestimonialsPage(next.testimonialsPage);
    }

    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  useEffect(() => {
    setFeedbackPage(1);
  }, [feedbackFilter, feedbackSearch]);

  useEffect(() => {
    setPremiumPage(1);
    setCreditsPage(1);
    setWebhooksPage(1);
  }, [billingFilter, billingSearch]);

  useEffect(() => {
    setUsersPage(1);
  }, [usersFilter, usersSearch]);

  useEffect(() => {
    setSubjectsPage(1);
  }, [subjectsFilter, subjectsSearch]);

  useEffect(() => {
    setInstitutionsPage(1);
  }, [institutionsSearch]);

  useEffect(() => {
    setFacultiesPage(1);
  }, [facultiesSearch, facultyInstitution]);

  useEffect(() => {
    setFreeAccessPage(1);
  }, [freeAccessSearch]);

  useEffect(() => {
    setTestimonialsPage(1);
  }, [testimonialsFilter, testimonialsSearch]);

  useEffect(() => {
    const actionKey = section === "billing" || section === "testimonials" ? section : null;

    if (!actionKey || !(visibleAdminActionSummary[actionKey] > 0)) {
      return;
    }

    const actionCount = visibleAdminActionSummary[actionKey] || 0;
    setVisibleAdminActionSummary((current) => ({
      ...current,
      [actionKey]: 0,
      platform: Math.max(0, (current.platform || 0) - actionCount),
      total: Math.max(0, (current.total || 0) - actionCount)
    }));
    markAdminNotificationViewed(ADMIN_NOTIFICATION_SCOPES[actionKey]).catch(() => {});
  }, [section, visibleAdminActionSummary]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("section", section);

    if (feedbackFilter !== "all") {
      params.set("feedback", feedbackFilter);
    }
    if (billingFilter !== "all") {
      params.set("billing", billingFilter);
    }
    if (usersFilter !== "all") {
      params.set("users", usersFilter);
    }
    if (subjectsFilter !== "all") {
      params.set("subjects", subjectsFilter);
    }
    if (academicSubtab !== "institutions") {
      params.set("academic_tab", academicSubtab);
    }
    if (feedbackSearch.trim()) {
      params.set("feedback_q", feedbackSearch.trim());
    }
    if (billingSearch.trim()) {
      params.set("billing_q", billingSearch.trim());
    }
    if (usersSearch.trim()) {
      params.set("users_q", usersSearch.trim());
    }
    if (subjectsSearch.trim()) {
      params.set("subjects_q", subjectsSearch.trim());
    }
    if (institutionsSearch.trim()) {
      params.set("institutions_q", institutionsSearch.trim());
    }
    if (facultiesSearch.trim()) {
      params.set("faculties_q", facultiesSearch.trim());
    }
    if (freeAccessSearch.trim()) {
      params.set("free_access_q", freeAccessSearch.trim());
    }
    if (testimonialsFilter !== "all") {
      params.set("testimonials", testimonialsFilter);
    }
    if (testimonialsSearch.trim()) {
      params.set("testimonials_q", testimonialsSearch.trim());
    }
    if (facultyInstitution) {
      params.set("faculty_institution", facultyInstitution);
    }
    if (feedbackPage > 1) {
      params.set("feedback_page", String(feedbackPage));
    }
    if (usersPage > 1) {
      params.set("users_page", String(usersPage));
    }
    if (subjectsPage > 1) {
      params.set("subjects_page", String(subjectsPage));
    }
    if (institutionsPage > 1) {
      params.set("institutions_page", String(institutionsPage));
    }
    if (facultiesPage > 1) {
      params.set("faculties_page", String(facultiesPage));
    }
    if (premiumPage > 1) {
      params.set("premium_page", String(premiumPage));
    }
    if (creditsPage > 1) {
      params.set("credits_page", String(creditsPage));
    }
    if (webhooksPage > 1) {
      params.set("webhooks_page", String(webhooksPage));
    }
    if (freeAccessPage > 1) {
      params.set("free_access_page", String(freeAccessPage));
    }
    if (testimonialsPage > 1) {
      params.set("testimonials_page", String(testimonialsPage));
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `/admin?${nextQuery}` : "/admin";
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [
    section,
    feedbackFilter,
    billingFilter,
    usersFilter,
    subjectsFilter,
    academicSubtab,
    feedbackSearch,
    billingSearch,
    usersSearch,
    subjectsSearch,
    institutionsSearch,
    facultiesSearch,
    freeAccessSearch,
    testimonialsFilter,
    testimonialsSearch,
    facultyInstitution,
    feedbackPage,
    usersPage,
    subjectsPage,
    institutionsPage,
    facultiesPage,
    premiumPage,
    creditsPage,
    webhooksPage,
    freeAccessPage,
    testimonialsPage
  ]);

  const filteredFeedbackEntries = useMemo(() => {
    return feedbackEntries.filter((entry) => {
      if (feedbackFilter !== "all" && entry.feedback_type !== feedbackFilter) {
        return false;
      }

      if (!feedbackSearch.trim()) {
        return true;
      }

      const haystack = [
        feedbackTypeLabel(entry.feedback_type),
        entry.message,
        entry.optional_detail,
        entry.user_email,
        entry.page_path
      ].join(" ");

      return matchesSearch(haystack, feedbackSearch);
    });
  }, [feedbackEntries, feedbackFilter, feedbackSearch]);

  const filteredPremiumRows = useMemo(
    () =>
      billingData.premiumRows.filter((row) =>
        !billingSearch.trim()
          ? true
          : matchesSearch(
              [row.user_email, row.user_id, row.plan_name, row.source, row.stripe_checkout_session_id].join(" "),
              billingSearch
            )
      ),
    [billingData.premiumRows, billingSearch]
  );

  const filteredCreditRows = useMemo(
    () =>
      billingData.creditRows.filter((row) =>
        !billingSearch.trim()
          ? true
          : matchesSearch(
              [row.user_email, row.user_id, row.plan_name, row.source, row.stripe_checkout_session_id].join(" "),
              billingSearch
            )
      ),
    [billingData.creditRows, billingSearch]
  );

  const filteredWebhookRows = useMemo(
    () =>
      billingData.webhookRows.filter((row) =>
        !billingSearch.trim()
          ? true
          : matchesSearch(
              [row.event_type, row.status, row.stripe_event_id, row.last_error].join(" "),
              billingSearch
            )
      ),
    [billingData.webhookRows, billingSearch]
  );

  const filteredUsers = useMemo(() => {
    return userRows.filter((user) => {
      if (usersFilter === "students" && user.user_type !== "student") {
        return false;
      }
      if (usersFilter === "elevi" && user.user_type !== "elev") {
        return false;
      }
      if (usersFilter === "completed" && !user.onboarding_completed) {
        return false;
      }
      if (usersFilter === "incomplete" && user.onboarding_completed) {
        return false;
      }
      if (!usersSearch.trim()) {
        return true;
      }

      return matchesSearch(
        [user.full_name, user.email, user.community_label, user.user_type, user.membership_status].join(" "),
        usersSearch
      );
    });
  }, [userRows, usersFilter, usersSearch]);

  const filteredSubjects = useMemo(() => {
    return subjectsData.rows.filter((subject) => {
      if (subjectsFilter === "student" && !subject.contexts.includes("student")) {
        return false;
      }
      if (subjectsFilter === "elev" && !subject.contexts.includes("elev")) {
        return false;
      }
      if (subjectsFilter === "unassigned" && subject.allocation_count > 0) {
        return false;
      }
      if (!subjectsSearch.trim()) {
        return true;
      }

      return matchesSearch(
        [subject.title, subject.id, subject.questions_file, subject.created_by_email, subject.source].join(" "),
        subjectsSearch
      );
    });
  }, [subjectsData.rows, subjectsFilter, subjectsSearch]);

  const filteredInstitutions = useMemo(() => {
    return academicData.institutionRows.filter((institution) =>
      !institutionsSearch.trim()
        ? true
        : matchesSearch(
            [institution.name, institution.type, institution.city, institution.source].join(" "),
            institutionsSearch
          )
    );
  }, [academicData.institutionRows, institutionsSearch]);

  const filteredFaculties = useMemo(() => {
    return academicData.facultyRows.filter((faculty) => {
      if (facultyInstitution && faculty.id !== facultyInstitution && faculty.institution_id !== facultyInstitution) {
        return false;
      }

      if (!facultiesSearch.trim()) {
        return true;
      }

      return matchesSearch(
        [faculty.name, faculty.institution_name, faculty.unit_type, faculty.source].join(" "),
        facultiesSearch
      );
    });
  }, [academicData.facultyRows, facultiesSearch, facultyInstitution]);

  const filteredFreeAccessRows = useMemo(() => {
    return freeAccessRows.filter((row) =>
      !freeAccessSearch.trim()
        ? true
        : matchesSearch(
            [row.email, row.grant_kind, row.notes, row.added_by_email, row.is_active ? "activ" : "inactiv"].join(
              " "
            ),
            freeAccessSearch
          )
    );
  }, [freeAccessRows, freeAccessSearch]);

  const filteredTestimonials = useMemo(() => {
    return testimonialRows.filter((row) => {
      if (testimonialsFilter !== "all" && row.status !== testimonialsFilter) {
        return false;
      }

      if (!testimonialsSearch.trim()) {
        return true;
      }

      return matchesSearch(
        [
          row.user_email,
          row.edited_testimonial,
          row.public_testimonial,
          row.admin_note,
          row.reward_type,
          row.status
        ].join(" "),
        testimonialsSearch
      );
    });
  }, [testimonialRows, testimonialsFilter, testimonialsSearch]);

  const feedbackPageData = paginateRows(filteredFeedbackEntries, feedbackPage);
  const usersPageData = paginateRows(filteredUsers, usersPage);
  const subjectsPageData = paginateRows(filteredSubjects, subjectsPage);
  const institutionsPageData = paginateRows(filteredInstitutions, institutionsPage);
  const facultiesPageData = paginateRows(filteredFaculties, facultiesPage);
  const premiumPageData = paginateRows(filteredPremiumRows, premiumPage);
  const creditsPageData = paginateRows(filteredCreditRows, creditsPage);
  const webhooksPageData = paginateRows(filteredWebhookRows, webhooksPage);
  const freeAccessPageData = paginateRows(filteredFreeAccessRows, freeAccessPage);
  const testimonialsPageData = paginateRows(filteredTestimonials, testimonialsPage);

  const visibleBillingSections = billingFilter === "all" ? ["premium", "credits", "webhooks"] : [billingFilter];
  const selectedInstitution = academicData.institutionRows.find((institution) => institution.id === facultyInstitution);
  const feedbackCounts = {
    all: feedbackEntries.length,
    problem: feedbackEntries.filter((entry) => entry.feedback_type === "problem").length,
    feature: feedbackEntries.filter((entry) => entry.feedback_type === "feature").length,
    idea: feedbackEntries.filter((entry) => entry.feedback_type === "idea").length
  };
  const billingCounts = {
    all: billingData.premiumRows.length + billingData.creditRows.length + billingData.webhookRows.length,
    premium: billingData.premiumRows.length,
    credits: billingData.creditRows.length,
    webhooks: billingData.webhookRows.length
  };
  const userCounts = {
    all: userRows.length,
    students: userRows.filter((user) => user.user_type === "student").length,
    elevi: userRows.filter((user) => user.user_type === "elev").length,
    completed: userRows.filter((user) => user.onboarding_completed).length,
    incomplete: userRows.filter((user) => !user.onboarding_completed).length
  };
  const subjectCounts = {
    all: subjectsData.totalSubjects || subjectsData.rows.length,
    student: subjectsData.rows.filter((subject) => subject.contexts.includes("student")).length,
    elev: subjectsData.rows.filter((subject) => subject.contexts.includes("elev")).length,
    unassigned: subjectsData.rows.filter((subject) => subject.allocation_count < 1).length
  };
  const academicCounts = {
    all: Number(academicData.counts?.institutions || 0) + Number(academicData.counts?.faculties || 0),
    institutions: Number(academicData.counts?.institutions || academicData.institutionRows.length || 0),
    faculties: Number(academicData.counts?.faculties || academicData.facultyRows.length || 0)
  };
  const freeAccessCount = freeAccessRows.length;
  const testimonialCounts = {
    all: testimonialRows.length,
    pending: testimonialRows.filter((row) => row.status === "pending").length,
    approved: testimonialRows.filter((row) => row.status === "approved").length,
    rejected: testimonialRows.filter((row) => row.status === "rejected").length
  };
  const sectionCounts = {
    feedback: feedbackCounts.all,
    billing: billingCounts.all,
    users: userCounts.all,
    analytics: Number(usageAnalytics?.totalEvents || 0) + Number(learningAnalytics?.totalStudySets || 0),
    subjects: subjectCounts.all,
    academic: academicCounts.all,
    freeAccess: freeAccessCount,
    testimonials: testimonialCounts.all
  };

  function jumpToFaculties(institutionId) {
    setAcademicSubtab("faculties");
    setFacultyInstitution(institutionId);
    setFacultiesPage(1);
  }

  async function refreshFreeAccessRows() {
    try {
      const response = await fetch("/api/admin/free-access/list", {
        method: "GET",
        credentials: "same-origin"
      });
      const payload = await response.json();

      if (!response.ok || !Array.isArray(payload?.rows)) {
        return;
      }

      setFreeAccessRows(payload.rows);
    } catch {
      // Keep current rows if refresh fails.
    }
  }

  async function handleSubmitFreeAccess(event) {
    event.preventDefault();
    setFreeAccessError("");
    setFreeAccessSuccess("");

    if (!freeAccessInput.trim()) {
      setFreeAccessError("Adauga cel putin un email.");
      return;
    }

    setIsSubmittingFreeAccess(true);

    try {
      const response = await fetch("/api/admin/free-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          emails: freeAccessInput,
          notes: freeAccessNotes
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFreeAccessError(payload?.error || "Nu am putut salva lista.");
        return;
      }

      const invalidPart =
        Array.isArray(payload.invalid) && payload.invalid.length
          ? ` Emailuri invalide ignorate: ${payload.invalid.join(", ")}.`
          : "";
      const warningPart = payload?.warning ? ` ${payload.warning}` : "";
      setFreeAccessSuccess(`Lista a fost salvata.${invalidPart}${warningPart}`);
      setFreeAccessInput("");
      setFreeAccessNotes("");
      await refreshFreeAccessRows();
    } catch {
      setFreeAccessError("A aparut o eroare la salvare.");
    } finally {
      setIsSubmittingFreeAccess(false);
    }
  }

  async function handleToggleFreeAccess(row) {
    setFreeAccessError("");
    setFreeAccessSuccess("");

    try {
      const response = await fetch("/api/admin/free-access", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          id: row.id,
          email: row.email,
          isActive: !row.is_active
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFreeAccessError(payload?.error || "Nu am putut actualiza statusul.");
        return;
      }

      await refreshFreeAccessRows();
      setFreeAccessSuccess(payload?.warning || "Statusul a fost actualizat.");
    } catch {
      setFreeAccessError("A aparut o eroare la actualizarea statusului.");
    }
  }

  async function handleUserDelete(user) {
    if (!user?.id) {
      return;
    }

    if (user.id === currentAdminUserId) {
      setUserActionError("Nu iti poti sterge propriul cont admin.");
      setUserActionSuccess("");
      return;
    }

    const displayName = user.email || user.full_name || user.id;
    const confirmed = window.confirm(
      `Stergi utilizatorul ${displayName}? Actiunea sterge contul si datele legate de el. Foloseste asta doar pentru teste.`
    );

    if (!confirmed) {
      return;
    }

    const typed = window.prompt(`Pentru confirmare, scrie exact STERGE.\nUtilizator: ${displayName}`);
    if (typed !== "STERGE") {
      setUserActionError("Stergerea a fost anulata. Confirmarea nu a fost introdusa exact.");
      setUserActionSuccess("");
      return;
    }

    setUserActionError("");
    setUserActionSuccess("");
    setDeletingUserId(user.id);

    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          id: user.id
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setUserActionError(payload?.error || "Nu am putut sterge utilizatorul.");
        return;
      }

      setUserRows((current) => current.filter((entry) => entry.id !== user.id));
      setUserActionSuccess(`Utilizatorul ${displayName} a fost sters. Poti reface onboarding-ul cu acel cont.`);
    } catch {
      setUserActionError("A aparut o eroare la stergerea utilizatorului.");
    } finally {
      setDeletingUserId("");
    }
  }

  async function handleDepublishStudySet(row) {
    if (!row?.id) return;

    const confirmed = window.confirm(
      `Scoti materialul "${row.title || "fara titlu"}" din comunitate? Materialul ramane in contul creatorului.`
    );

    if (!confirmed) return;

    setLearningActionMessage("");
    setDepublishingStudySetId(row.id);

    try {
      const response = await fetch(`/api/admin/learning-study-sets/${row.id}/depublish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          reason: "admin_review"
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setLearningActionMessage(payload?.error || "Nu am putut scoate materialul din comunitate.");
        return;
      }

      setLearningRows((current) =>
        current.map((entry) =>
          entry.id === row.id
            ? {
                ...entry,
                visibility_scope: "private",
                published_at: null,
                report_count: 0
              }
            : entry
        )
      );
      setLearningActionMessage("Materialul a fost scos din comunitate.");
    } catch {
      setLearningActionMessage("A aparut o eroare la depublish.");
    } finally {
      setDepublishingStudySetId("");
    }
  }

  async function handleTestimonialAction(row, action) {
    setTestimonialActionError("");
    setTestimonialActionSuccess("");
    setUpdatingTestimonialId(row.id);

    try {
      const response = await fetch("/api/admin/testimonial-rewards", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          id: row.id,
          action,
          adminNote: action === "reject" ? "Respins din admin." : "Aprobat din admin."
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setTestimonialActionError(payload?.error || "Nu am putut actualiza review-ul.");
        return;
      }

      const now = new Date().toISOString();
      setTestimonialRows((current) =>
        current.map((entry) =>
          entry.id === row.id
            ? {
                ...entry,
                status: action === "approve" ? "approved" : "rejected",
                admin_note: action === "approve" ? "Aprobat din admin." : "Respins din admin.",
                public_testimonial: action === "approve" ? entry.edited_testimonial : entry.public_testimonial,
                approved_at: action === "approve" ? now : entry.approved_at,
                rejected_at: action === "reject" ? now : entry.rejected_at
              }
            : entry
        )
      );
      setTestimonialActionSuccess(
        action === "approve" ? "Review aprobat. Recompensa este pregatita pentru activarea de catre utilizator." : "Review respins."
      );
    } catch {
      setTestimonialActionError("A aparut o eroare la actualizarea review-ului.");
    } finally {
      setUpdatingTestimonialId("");
    }
  }

  async function handleTestimonialDelete(row) {
    const confirmed = window.confirm(
      "Stergi acest review si resetezi dreptul utilizatorului de a trimite altul? Daca recompensa a fost activata de acest review, va fi retrasa."
    );

    if (!confirmed) {
      return;
    }

    setTestimonialActionError("");
    setTestimonialActionSuccess("");
    setUpdatingTestimonialId(row.id);

    try {
      const response = await fetch("/api/admin/testimonial-rewards", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({ id: row.id })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setTestimonialActionError(payload?.error || "Nu am putut sterge review-ul.");
        return;
      }

      setTestimonialRows((current) => current.filter((entry) => entry.id !== row.id));
      setTestimonialActionSuccess("Review sters. Utilizatorul poate trimite din nou.");
    } catch {
      setTestimonialActionError("A aparut o eroare la stergerea review-ului.");
    } finally {
      setUpdatingTestimonialId("");
    }
  }

  return (
    <>
      <section className="surface admin-section-tabs-surface">
        <AdminTabsContainer role="group" aria-label="Sectiuni admin">
          <FilterButton active={section === "feedback"} onClick={() => setSection("feedback")} selected={section === "feedback"} icon={MessageSquareText} count={sectionCounts.feedback}>Feedback</FilterButton>
          <FilterButton active={section === "billing"} onClick={() => setSection("billing")} selected={section === "billing"} icon={CreditCard} count={sectionCounts.billing} actionCount={visibleAdminActionSummary.billing || 0}>Plati</FilterButton>
          <FilterButton active={section === "users"} onClick={() => setSection("users")} selected={section === "users"} icon={Users} count={sectionCounts.users}>Utilizatori</FilterButton>
          <FilterButton active={section === "analytics"} onClick={() => setSection("analytics")} selected={section === "analytics"} icon={BarChart3} count={sectionCounts.analytics}>Analytics</FilterButton>
          <FilterButton active={section === "subjects"} onClick={() => setSection("subjects")} selected={section === "subjects"} icon={GraduationCap} count={sectionCounts.subjects}>Materii</FilterButton>
          <FilterButton active={section === "academic"} onClick={() => setSection("academic")} selected={section === "academic"} icon={Building2} count={sectionCounts.academic}>Structura academica</FilterButton>
          <FilterButton active={section === "free-access"} onClick={() => setSection("free-access")} selected={section === "free-access"} icon={KeyRound} count={sectionCounts.freeAccess}>Acces gratuit</FilterButton>
          <FilterButton active={section === "testimonials"} onClick={() => setSection("testimonials")} selected={section === "testimonials"} icon={Star} count={sectionCounts.testimonials} actionCount={visibleAdminActionSummary.testimonials || 0}>Testimoniale</FilterButton>
        </AdminTabsContainer>
      </section>

      <section className={`surface admin-panel ${section === "feedback" ? "is-visible" : "is-hidden"}`} aria-hidden={section !== "feedback"}>
        <div className="dashboard-header admin-section-intro">
          <div>
            <h2>Inbox feedback</h2>
            <p className="page-copy">Vezi rapid ce nu merge, ce lipseste si ce cerinte noi apar de la utilizatori.</p>
          </div>
          <span className="status-pill is-muted">{filteredFeedbackEntries.length} rezultate</span>
        </div>

        <div className="admin-toolbar">
          <AdminTabsContainer className="admin-filter-row" role="group" aria-label="Filtre feedback">
            <FilterButton active={feedbackFilter === "all"} onClick={() => setFeedbackFilter("all")} selected={feedbackFilter === "all"} icon={ClipboardList} count={feedbackCounts.all}>Toate</FilterButton>
            <FilterButton active={feedbackFilter === "problem"} onClick={() => setFeedbackFilter("problem")} selected={feedbackFilter === "problem"} icon={ShieldCheck} count={feedbackCounts.problem}>Probleme</FilterButton>
            <FilterButton active={feedbackFilter === "feature"} onClick={() => setFeedbackFilter("feature")} selected={feedbackFilter === "feature"} icon={Sparkles} count={feedbackCounts.feature}>Cerinte noi</FilterButton>
            <FilterButton active={feedbackFilter === "idea"} onClick={() => setFeedbackFilter("idea")} selected={feedbackFilter === "idea"} icon={Lightbulb} count={feedbackCounts.idea}>Idei</FilterButton>
          </AdminTabsContainer>
          <SearchInput value={feedbackSearch} onChange={setFeedbackSearch} placeholder="Cauta in mesaj, detaliu, email sau pagina" />
        </div>

        {filteredFeedbackEntries.length ? (
          <>
            <AdminTable minWidth={1120} columns={[
              { key: "review", label: "" },
              { key: "type", label: "Tip" },
              { key: "message", label: "Mesaj" },
              { key: "detail", label: "Detaliu" },
              { key: "email", label: "Email" },
              { key: "userType", label: "Tip user" },
              { key: "path", label: "Pagina" },
              { key: "createdAt", label: "Trimis la" }
            ]}>
              {feedbackPageData.rows.map((entry) => (
                <tr key={entry.id} className={entry.feedback_type === "problem" ? "has-admin-review" : undefined}>
                  <td className="admin-review-cell">
                    <ReviewDot show={entry.feedback_type === "problem"} label="Problema de verificat" />
                  </td>
                  <td><CellPill>{feedbackTypeLabel(entry.feedback_type)}</CellPill></td>
                  <td className="admin-table-text-cell admin-table-wide-cell">{entry.message}</td>
                  <td className="admin-table-text-cell">{entry.optional_detail || "-"}</td>
                  <td>{entry.user_email || "Fara email"}</td>
                  <td>{entry.user_type || "necunoscut"}</td>
                  <td className="admin-table-text-cell">{entry.page_path || "/"}</td>
                  <td><TableDate value={entry.created_at} /></td>
                </tr>
              ))}
            </AdminTable>
            <PaginationControls page={feedbackPageData.page} totalPages={feedbackPageData.totalPages} onChange={setFeedbackPage} />
          </>
        ) : (
          <EmptyState title="Nu exista feedback pentru filtrul ales." subtitle="Schimba filtrul sau revino mai tarziu." />
        )}
      </section>

      <section className={`surface admin-panel ${section === "billing" ? "is-visible" : "is-hidden"}`} aria-hidden={section !== "billing"}>
        <div className="dashboard-header admin-section-intro">
          <div>
            <h2>Monitorizare plati</h2>
            <p className="page-copy">Vezi intr-un singur loc granturile premium, incarcarile si webhook-urile recente.</p>
          </div>
          <span className="status-pill is-muted">Monitorizare read-only</span>
        </div>

        <div className="admin-toolbar">
          <AdminTabsContainer className="admin-filter-row" role="group" aria-label="Filtre plati">
            <FilterButton active={billingFilter === "all"} onClick={() => setBillingFilter("all")} selected={billingFilter === "all"} icon={ReceiptText} count={billingCounts.all}>Toate</FilterButton>
            <FilterButton active={billingFilter === "premium"} onClick={() => setBillingFilter("premium")} selected={billingFilter === "premium"} icon={ShieldCheck} count={billingCounts.premium}>Premium</FilterButton>
            <FilterButton active={billingFilter === "credits"} onClick={() => setBillingFilter("credits")} selected={billingFilter === "credits"} icon={Upload} count={billingCounts.credits}>Incarcari</FilterButton>
            <FilterButton active={billingFilter === "webhooks"} onClick={() => setBillingFilter("webhooks")} selected={billingFilter === "webhooks"} icon={Sparkles} count={billingCounts.webhooks} actionCount={visibleAdminActionSummary.billing || 0}>Webhook-uri</FilterButton>
          </AdminTabsContainer>
          <SearchInput value={billingSearch} onChange={setBillingSearch} placeholder="Cauta utilizator, plan, sesiune Stripe sau eveniment" />
        </div>

        <div className="admin-billing-stack">
          {visibleBillingSections.includes("premium") ? (
            <TableSection title="Granturi premium" subtitle="Vezi ce planuri au fost activate si pana cand sunt valabile." count={filteredPremiumRows.length}>
              {filteredPremiumRows.length ? (
                <>
                  <AdminTable minWidth={1040} columns={[
                    { key: "user", label: "Utilizator" },
                    { key: "plan", label: "Plan" },
                    { key: "source", label: "Sursa" },
                    { key: "session", label: "Sesiune Stripe" },
                    { key: "createdAt", label: "Creat la" },
                    { key: "endsAt", label: "Valabil pana la" }
                  ]}>
                    {premiumPageData.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="admin-table-text-cell">{row.user_email || row.user_id}</td>
                        <td>{row.plan_name}</td>
                        <td>{row.source}</td>
                        <td className="admin-table-code-cell">{row.stripe_checkout_session_id || "-"}</td>
                        <td><TableDate value={row.created_at} /></td>
                        <td><TableDate value={row.ends_at} /></td>
                      </tr>
                    ))}
                  </AdminTable>
                  <PaginationControls page={premiumPageData.page} totalPages={premiumPageData.totalPages} onChange={setPremiumPage} />
                </>
              ) : (
                <EmptyState title="Nu exista granturi premium pentru filtrul ales." subtitle="Incearca alt filtru sau revino mai tarziu." />
              )}
            </TableSection>
          ) : null}

          {visibleBillingSections.includes("credits") ? (
            <TableSection title="Incarcari materiale" subtitle="Vezi pachetele cumparate pentru materiale si actualizarile recente." count={filteredCreditRows.length}>
              {filteredCreditRows.length ? (
                <>
                  <AdminTable minWidth={1040} columns={[
                    { key: "user", label: "Utilizator" },
                    { key: "plan", label: "Pachet" },
                    { key: "delta", label: "Valoare" },
                    { key: "source", label: "Sursa" },
                    { key: "session", label: "Sesiune Stripe" },
                    { key: "createdAt", label: "Creat la" }
                  ]}>
                    {creditsPageData.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="admin-table-text-cell">{row.user_email || row.user_id}</td>
                        <td>{row.plan_name}</td>
                        <td><CellPill tone="good">{`+${row.delta}`}</CellPill></td>
                        <td>{row.source}</td>
                        <td className="admin-table-code-cell">{row.stripe_checkout_session_id || "-"}</td>
                        <td><TableDate value={row.created_at} /></td>
                      </tr>
                    ))}
                  </AdminTable>
                  <PaginationControls page={creditsPageData.page} totalPages={creditsPageData.totalPages} onChange={setCreditsPage} />
                </>
              ) : (
                <EmptyState title="Nu exista incarcari pentru filtrul ales." subtitle="Incearca alt filtru sau revino mai tarziu." />
              )}
            </TableSection>
          ) : null}

          {visibleBillingSections.includes("webhooks") ? (
            <TableSection title="Webhook-uri Stripe" subtitle="Vezi daca evenimentele au intrat corect si daca exista erori de procesare." count={filteredWebhookRows.length}>
              {filteredWebhookRows.length ? (
                <>
                  <AdminTable minWidth={1040} columns={[
                    { key: "review", label: "" },
                    { key: "event", label: "Eveniment" },
                    { key: "status", label: "Status" },
                    { key: "stripeEvent", label: "Stripe event" },
                    { key: "error", label: "Eroare" },
                    { key: "processedAt", label: "Procesat la" }
                  ]}>
                    {webhooksPageData.rows.map((row) => {
                      const needsReview = row.status === "failed" || Boolean(row.last_error);

                      return (
                      <tr key={row.id} className={needsReview ? "has-admin-review" : undefined}>
                        <td className="admin-review-cell">
                          <ReviewDot show={needsReview} label="Webhook de verificat" />
                        </td>
                        <td>{row.event_type}</td>
                        <td><CellPill tone={row.status === "completed" ? "good" : row.status === "failed" ? "bad" : "warning"}>{row.status || "necunoscut"}</CellPill></td>
                        <td className="admin-table-code-cell">{row.stripe_event_id}</td>
                        <td className="admin-table-text-cell">{row.last_error || "Fara erori"}</td>
                        <td><TableDate value={row.processed_at} /></td>
                      </tr>
                    );
                    })}
                  </AdminTable>
                  <PaginationControls page={webhooksPageData.page} totalPages={webhooksPageData.totalPages} onChange={setWebhooksPage} />
                </>
              ) : (
                <EmptyState title="Nu exista webhook-uri pentru filtrul ales." subtitle="Incearca alt filtru sau revino mai tarziu." />
              )}
            </TableSection>
          ) : null}
        </div>
      </section>

      <section className={`surface admin-panel ${section === "users" ? "is-visible" : "is-hidden"}`} aria-hidden={section !== "users"}>
        <div className="dashboard-header admin-section-intro">
          <div>
            <h2>Utilizatori</h2>
            <p className="page-copy">Vezi cine a intrat in aplicatie, daca a terminat onboarding-ul si in ce comunitate este activ.</p>
          </div>
          <span className="status-pill is-muted">{filteredUsers.length} rezultate</span>
        </div>

        <div className="admin-toolbar">
          <AdminTabsContainer className="admin-filter-row" role="group" aria-label="Filtre utilizatori">
            <FilterButton active={usersFilter === "all"} onClick={() => setUsersFilter("all")} selected={usersFilter === "all"} icon={Users} count={userCounts.all}>Toti</FilterButton>
            <FilterButton active={usersFilter === "students"} onClick={() => setUsersFilter("students")} selected={usersFilter === "students"} icon={GraduationCap} count={userCounts.students}>Studenti</FilterButton>
            <FilterButton active={usersFilter === "elevi"} onClick={() => setUsersFilter("elevi")} selected={usersFilter === "elevi"} icon={School} count={userCounts.elevi}>Elevi</FilterButton>
            <FilterButton active={usersFilter === "completed"} onClick={() => setUsersFilter("completed")} selected={usersFilter === "completed"} icon={CheckCircle2} count={userCounts.completed}>Onboarding complet</FilterButton>
            <FilterButton active={usersFilter === "incomplete"} onClick={() => setUsersFilter("incomplete")} selected={usersFilter === "incomplete"} icon={XCircle} count={userCounts.incomplete}>Onboarding incomplet</FilterButton>
          </AdminTabsContainer>
          <SearchInput value={usersSearch} onChange={setUsersSearch} placeholder="Cauta nume, email sau comunitate activa" />
        </div>

        {userActionError ? <p className="admin-inline-error" role="alert">{userActionError}</p> : null}
        {userActionSuccess ? <p className="admin-inline-success" role="status">{userActionSuccess}</p> : null}

        {filteredUsers.length ? (
          <>
            <AdminTable minWidth={1220} columns={[
              { key: "name", label: "Nume" },
              { key: "email", label: "Email" },
              { key: "type", label: "Tip" },
              { key: "onboarding", label: "Onboarding" },
              { key: "community", label: "Comunitate activa" },
              { key: "createdAt", label: "Creat la" },
              { key: "completedAt", label: "Onboarding finalizat" },
              { key: "membership", label: "Membership" },
              { key: "actions", label: "Actiuni" }
            ]}>
              {usersPageData.rows.map((user) => {
                const displayName = user.full_name || user.email || "Utilizator fara nume";
                return (
                  <tr key={user.id}>
                    <td className="admin-table-name-cell">{displayName}</td>
                    <td className="admin-table-text-cell">{user.email || "Fara email"}</td>
                    <td><CellPill>{userTypeLabel(user.user_type)}</CellPill></td>
                    <td><CellPill tone={user.onboarding_completed ? "good" : "warning"}>{user.onboarding_completed ? "Complet" : "Incomplet"}</CellPill></td>
                    <td className="admin-table-text-cell admin-table-wide-cell admin-table-wide-cell--xl">{user.community_label || "Fara comunitate activa"}</td>
                    <td><TableDate value={user.created_at} /></td>
                    <td>{user.onboarding_completed_at ? <TableDate value={user.onboarding_completed_at} /> : "-"}</td>
                    <td>{user.membership_status || "fara membership activ"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-link secondary admin-toggle-btn admin-danger-action"
                        onClick={() => handleUserDelete(user)}
                        disabled={deletingUserId === user.id || user.id === currentAdminUserId}
                        title={
                          user.id === currentAdminUserId
                            ? "Nu iti poti sterge propriul cont admin"
                            : "Sterge utilizatorul pentru teste"
                        }
                      >
                        <Trash2 aria-hidden="true" size={15} />
                        Sterge
                      </button>
                    </td>
                  </tr>
                );
              })}
            </AdminTable>
            <PaginationControls page={usersPageData.page} totalPages={usersPageData.totalPages} onChange={setUsersPage} />
          </>
        ) : (
          <EmptyState title="Nu exista utilizatori pentru filtrul ales." subtitle="Schimba filtrul sau revino mai tarziu." />
        )}
      </section>

      <section className={`surface admin-panel ${section === "analytics" ? "is-visible" : "is-hidden"}`} aria-hidden={section !== "analytics"}>
        <div className="dashboard-header admin-section-intro">
          <div>
            <h2>Analytics utilizare</h2>
            <p className="page-copy">Vezi ce zone sunt folosite cel mai mult, cine este activ si unde merita imbunatatit produsul.</p>
          </div>
          <span className="status-pill is-muted">{`${usageAnalytics?.windowDays || 30} zile`}</span>
        </div>

        {usageAnalytics?.warning ? (
          <div className="workspace-context-summary admin-analytics-warning">
            <strong>Nota analytics</strong>
            <span>{usageAnalytics.warning}</span>
          </div>
        ) : null}

        {usageAnalytics?.available === false ? (
          <EmptyState
            title="Analytics-ul nu este disponibil inca."
            subtitle="Aplica migrarea noua, apoi evenimentele vor incepe sa se stranga automat."
          />
        ) : (
          <>
            <div className="admin-analytics-kpi-grid">
              <AnalyticsKpi icon={BarChart3} label="Evenimente" value={usageAnalytics?.totalEvents} hint="total in fereastra" />
              <AnalyticsKpi icon={Route} label="Vizualizari pagini" value={usageAnalytics?.pageViews} hint="navigari" />
              <AnalyticsKpi icon={MousePointerClick} label="Click-uri" value={usageAnalytics?.clicks} hint="actiuni UI" />
              <AnalyticsKpi icon={BookOpen} label="Actiuni invatare" value={usageAnalytics?.learningEvents} hint="modul invatare" />
              <AnalyticsKpi icon={Users} label="Utilizatori" value={usageAnalytics?.uniqueUsers} hint="logati" />
              <AnalyticsKpi icon={Clock} label="Activi azi" value={usageAnalytics?.activeToday} hint="useri sau sesiuni" />
              <AnalyticsKpi icon={MonitorSmartphone} label="Sesiuni anonime" value={usageAnalytics?.anonymousSessions} hint="fara cont" />
            </div>

            {learningAnalytics?.warning ? (
              <div className="workspace-context-summary admin-analytics-warning">
                <strong>Nota invatare</strong>
                <span>{learningAnalytics.warning}</span>
              </div>
            ) : null}

            {learningAnalytics?.available === false ? (
              <EmptyState
                title="Analytics-ul pentru invatare nu este disponibil inca."
                subtitle="Dupa aplicarea migrarii pentru study sets, materialele procesate vor aparea aici."
              />
            ) : (
              <>
                <div className="admin-analytics-kpi-grid">
                  <AnalyticsKpi icon={BookOpen} label="Materiale invatare" value={learningAnalytics?.totalStudySets} hint="recente" />
                  <AnalyticsKpi icon={CheckCircle2} label="Gata" value={learningAnalytics?.readyStudySets} hint="ready" />
                  <AnalyticsKpi icon={Lightbulb} label="Cu atentionari" value={learningAnalytics?.warningStudySets} hint="needs review" />
                  <AnalyticsKpi icon={XCircle} label="Esuate" value={learningAnalytics?.failedStudySets} hint="failed" />
                  <AnalyticsKpi icon={Users} label="Publicate" value={learningAnalytics?.publishedStudySets} hint="comunitate" />
                  <AnalyticsKpi icon={ShieldCheck} label="Private" value={learningAnalytics?.privateStudySets} hint="doar owner" />
                  <AnalyticsKpi icon={Clock} label="Nefolosite" value={learningAnalytics?.unusedStudySets} hint="dupa procesare" />
                  <AnalyticsKpi icon={MessageSquareText} label="Raportari" value={learningAnalytics?.pendingReports} hint="pending" />
                  <AnalyticsKpi icon={XCircle} label="Erori recente" value={learningAnalytics?.processingErrors?.length || 0} hint="upload/procesare" />
                  <AnalyticsKpi icon={Users} label="Reutilizari" value={learningAnalytics?.communityReuses || 0} hint="colegi fara incarcare noua" />
                </div>

                <div className="admin-analytics-grid">
                  <TableSection title="Status invatare" subtitle="Cum arata materialele procesate recent." count={learningAnalytics?.statusBreakdown?.length || 0}>
                    <AnalyticsList rows={learningAnalytics?.statusBreakdown || []} />
                  </TableSection>

                  <TableSection title="Surse invatare" subtitle="Tipurile de fisiere si text folosite in modul." count={learningAnalytics?.sourceBreakdown?.length || 0}>
                    <AnalyticsList rows={learningAnalytics?.sourceBreakdown || []} />
                  </TableSection>

                  <TableSection title="Durate procesare" subtitle="Media pe etape pentru materialele recente." count={learningAnalytics?.stageDurationBreakdown?.length || 0}>
                    <AnalyticsList rows={learningAnalytics?.stageDurationBreakdown || []} emptyLabel="Duratele apar dupa urmatoarele procesari." />
                  </TableSection>
                </div>

                <div className="admin-analytics-grid">
                  <TableSection title="Top materiale invatare" subtitle="Materiale cu folosire reala in teste si flashcards." count={learningAnalytics?.topStudySets?.length || 0}>
                    {learningAnalytics?.topStudySets?.length ? (
                      <AdminTable minWidth={760} columns={[
                        { key: "title", label: "Material" },
                        { key: "status", label: "Status" },
                        { key: "users", label: "Useri" },
                        { key: "tests", label: "Teste" },
                        { key: "cards", label: "Flashcards" },
                        { key: "visibility", label: "Vizibilitate" }
                      ]}>
                        {learningAnalytics.topStudySets.map((row) => (
                          <tr key={row.id}>
                            <td className="admin-table-name-cell">{row.title}</td>
                            <td><CellPill tone={learningStatusTone(row.status)}>{formatUsageLabel(row.status)}</CellPill></td>
                            <td>{formatNumber(row.active_user_count)}</td>
                            <td>{formatNumber(row.attempt_count)}</td>
                            <td>{formatNumber(row.flashcard_review_count)}</td>
                            <td>{formatUsageLabel(row.visibility_scope)}</td>
                          </tr>
                        ))}
                      </AdminTable>
                    ) : (
                      <EmptyState title="Nu exista materiale folosite inca." subtitle="Topul apare dupa teste sau flashcards salvate." />
                    )}
                  </TableSection>

                  <TableSection title="Top contributori" subtitle="Autori ale caror materiale publicate sunt refolosite de colegi." count={learningAnalytics?.topContributors?.length || 0}>
                    {learningAnalytics?.topContributors?.length ? (
                      <AdminTable minWidth={760} columns={[
                        { key: "user", label: "Utilizator" },
                        { key: "published", label: "Publicate" },
                        { key: "reuse", label: "Reutilizari" },
                        { key: "users", label: "Useri activi" },
                        { key: "last", label: "Ultima publicare" }
                      ]}>
                        {learningAnalytics.topContributors.map((row) => (
                          <tr key={row.user_id || "unknown"}>
                            <td className="admin-table-text-cell">{row.user_email || row.user_id || "-"}</td>
                            <td>{formatNumber(row.published_count)}</td>
                            <td>{formatNumber(row.reuse_count)}</td>
                            <td>{formatNumber(row.active_user_count)}</td>
                            <td><TableDate value={row.last_published_at} /></td>
                          </tr>
                        ))}
                      </AdminTable>
                    ) : (
                      <EmptyState title="Nu exista contributori cu reutilizari inca." subtitle="Aici apar materialele publicate si folosite de colegi." />
                    )}
                  </TableSection>
                </div>

                <TableSection title="Erori procesare invatare" subtitle="Ultimele uploaduri sau procesari care nu au ajuns la material gata." count={learningAnalytics?.processingErrors?.length || 0}>
                  {learningAnalytics?.processingErrors?.length ? (
                    <AdminTable minWidth={980} columns={[
                      { key: "date", label: "Data" },
                      { key: "title", label: "Material" },
                      { key: "user", label: "Utilizator" },
                      { key: "source", label: "Sursa" },
                      { key: "duration", label: "Durata" },
                      { key: "error", label: "Eroare" }
                    ]}>
                      {learningAnalytics.processingErrors.map((row) => (
                        <tr key={row.id}>
                          <td><TableDate value={row.created_at} /></td>
                          <td className="admin-table-name-cell">{row.title || "Material fara titlu"}</td>
                          <td className="admin-table-text-cell">{row.user_email || row.user_id || "-"}</td>
                          <td>{formatUsageLabel(row.source_kind)}</td>
                          <td>{formatDurationMs(row.processing_duration_ms)}</td>
                          <td className="admin-table-text-cell">{row.error || "Eroare necunoscuta"}</td>
                        </tr>
                      ))}
                    </AdminTable>
                  ) : (
                    <EmptyState title="Nu exista erori recente in modulul de invatare." subtitle="Aici apar uploadurile sau procesarile care au esuat." />
                  )}
                </TableSection>

                {learningActionMessage ? <p className="admin-inline-success" role="status">{learningActionMessage}</p> : null}

                <TableSection title="Materiale de invatare recente" subtitle="Ultimele study sets generate sau publicate." count={learningAnalytics?.recentStudySets?.length || 0}>
                  {learningRows?.length ? (
                    <AdminTable minWidth={1280} columns={[
                      { key: "date", label: "Data" },
                      { key: "title", label: "Titlu" },
                      { key: "user", label: "Utilizator" },
                      { key: "status", label: "Status" },
                      { key: "source", label: "Sursa" },
                      { key: "content", label: "Continut" },
                      { key: "processing", label: "Procesare" },
                      { key: "usage", label: "Folosire" },
                      { key: "visibility", label: "Vizibilitate" },
                      { key: "reports", label: "Raportari" },
                      { key: "actions", label: "Actiuni" }
                    ]}>
                      {learningRows.map((row) => (
                        <tr key={row.id}>
                          <td><TableDate value={row.created_at} /></td>
                          <td className="admin-table-name-cell">{row.title || "Fara titlu"}</td>
                          <td className="admin-table-text-cell">{row.user_email || row.user_id || "-"}</td>
                          <td><CellPill tone={learningStatusTone(row.status)}>{formatUsageLabel(row.status)}</CellPill></td>
                          <td>{formatUsageLabel(row.source_kind)}</td>
                          <td className="admin-table-text-cell">
                            {`${formatNumber(row.chapter_count)} capitole, ${formatNumber(row.flashcard_count)} flashcards, ${formatNumber(row.question_count)} intrebari`}
                          </td>
                          <td className="admin-table-text-cell">
                            {`${formatDurationMs(row.processing_duration_ms)} · ${row.credit_consumed ? "1 incarcare" : "fara consum marcat"}`}
                          </td>
                          <td className="admin-table-text-cell">
                            {`${formatNumber(row.active_user_count)} useri, ${formatNumber(row.attempt_count)} teste, ${formatNumber(row.flashcard_review_count)} flashcards`}
                          </td>
                          <td>{formatUsageLabel(row.visibility_scope || "private")}</td>
                          <td><CellPill tone={row.report_count > 0 ? "warning" : "default"}>{formatNumber(row.report_count || 0)}</CellPill></td>
                          <td>
                            {row.published_at ? (
                              <button
                                type="button"
                                className="btn-link secondary admin-toggle-btn"
                                disabled={depublishingStudySetId === row.id}
                                onClick={() => handleDepublishStudySet(row)}
                              >
                                {depublishingStudySetId === row.id ? "Se scoate..." : "Scoate din comunitate"}
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </AdminTable>
                  ) : (
                    <EmptyState title="Nu exista materiale de invatare inca." subtitle="Primele materiale apar aici dupa procesare." />
                  )}
                </TableSection>
              </>
            )}

            <div className="admin-analytics-grid">
              <TableSection title="Moduri invatare folosite" subtitle="Actiunile principale din modulul Invata." count={usageAnalytics?.learningTopActions?.length || 0}>
                <AnalyticsList rows={usageAnalytics?.learningTopActions || []} emptyLabel="Nu exista actiuni de invatare inca." />
              </TableSection>

              <TableSection title="Zone folosite" subtitle="Feature-urile cu cele mai multe evenimente." count={usageAnalytics?.topFeatures?.length || 0}>
                <AnalyticsList rows={usageAnalytics?.topFeatures || []} />
              </TableSection>

              <TableSection title="Rute populare" subtitle="Paginile cu cele mai multe vizualizari." count={usageAnalytics?.topRoutes?.length || 0}>
                <AnalyticsList rows={usageAnalytics?.topRoutes || []} />
              </TableSection>

              <TableSection title="Tipuri evenimente" subtitle="Separare intre navigari, click-uri si evenimente custom." count={usageAnalytics?.topEvents?.length || 0}>
                <AnalyticsList rows={usageAnalytics?.topEvents || []} />
              </TableSection>

              <TableSection title="Device-uri" subtitle="Dimensiuni aproximative din browser." count={usageAnalytics?.deviceBreakdown?.length || 0}>
                <AnalyticsList rows={usageAnalytics?.deviceBreakdown || []} />
              </TableSection>
            </div>

            <TableSection title="Activitate zilnica" subtitle="Ultimele zile, agregate pe evenimente si utilizatori." count={usageAnalytics?.dailyActivity?.length || 0}>
              <AnalyticsList
                rows={(usageAnalytics?.dailyActivity || []).map((row) => ({
                  key: row.date,
                  label: `${row.date} - ${row.users} useri, ${row.sessions} sesiuni`,
                  count: row.events
                }))}
                emptyLabel="Nu exista activitate zilnica inca."
              />
            </TableSection>

            <TableSection title="Utilizatori activi" subtitle="Cei mai activi utilizatori din fereastra curenta." count={usageAnalytics?.topUsers?.length || 0}>
              {usageAnalytics?.topUsers?.length ? (
                <AdminTable minWidth={1100} columns={[
                  { key: "user", label: "Utilizator" },
                  { key: "events", label: "Evenimente" },
                  { key: "pageViews", label: "Pagini" },
                  { key: "clicks", label: "Click-uri" },
                  { key: "feature", label: "Zona principala" },
                  { key: "route", label: "Ruta principala" },
                  { key: "lastSeen", label: "Ultima activitate" }
                ]}>
                  {usageAnalytics.topUsers.map((row) => (
                    <tr key={row.user_id}>
                      <td className="admin-table-text-cell">{row.user_email || row.user_id}</td>
                      <td className="admin-table-count-cell">{formatNumber(row.count)}</td>
                      <td className="admin-table-count-cell">{formatNumber(row.page_views)}</td>
                      <td className="admin-table-count-cell">{formatNumber(row.clicks)}</td>
                      <td>{row.top_feature || "-"}</td>
                      <td className="admin-table-text-cell">{row.top_route || "-"}</td>
                      <td><TableDate value={row.last_seen_at} /></td>
                    </tr>
                  ))}
                </AdminTable>
              ) : (
                <EmptyState title="Nu exista utilizatori activi inca." subtitle="Vor aparea dupa primele evenimente cu utilizatori logati." />
              )}
            </TableSection>

            <TableSection title="Evenimente recente" subtitle="Ultimele interactiuni salvate pentru audit rapid." count={usageAnalytics?.recentEvents?.length || 0}>
              {usageAnalytics?.recentEvents?.length ? (
                <AdminTable minWidth={1180} columns={[
                  { key: "date", label: "Data" },
                  { key: "user", label: "Utilizator" },
                  { key: "event", label: "Eveniment" },
                  { key: "feature", label: "Zona" },
                  { key: "route", label: "Ruta" },
                  { key: "device", label: "Device" }
                ]}>
                  {usageAnalytics.recentEvents.map((row) => (
                    <tr key={row.id}>
                      <td><TableDate value={row.created_at} /></td>
                      <td className="admin-table-text-cell">{row.user_email || row.session_id || "Anonim"}</td>
                      <td><CellPill>{formatUsageLabel(row.event_name)}</CellPill></td>
                      <td>{row.feature || "-"}</td>
                      <td className="admin-table-text-cell">{row.route_path || "-"}</td>
                      <td>{formatUsageLabel(row.device_type || "unknown")}</td>
                    </tr>
                  ))}
                </AdminTable>
              ) : (
                <EmptyState title="Nu exista evenimente recente." subtitle="Trackerul va popula tabelul dupa primele navigari." />
              )}
            </TableSection>
          </>
        )}
      </section>

      <section className={`surface admin-panel ${section === "subjects" ? "is-visible" : "is-hidden"}`} aria-hidden={section !== "subjects"}>
        <div className="dashboard-header admin-section-intro">
          <div>
            <h2>Materii</h2>
            <p className="page-copy">Vezi catalogul de materii, numarul de alocari si contextul in care este folosita fiecare.</p>
          </div>
          <span className="status-pill is-muted">{filteredSubjects.length} rezultate</span>
        </div>

        <div className="admin-toolbar">
          <AdminTabsContainer className="admin-filter-row" role="group" aria-label="Filtre materii">
            <FilterButton active={subjectsFilter === "all"} onClick={() => setSubjectsFilter("all")} selected={subjectsFilter === "all"} icon={ClipboardList} count={subjectCounts.all}>Toate</FilterButton>
            <FilterButton active={subjectsFilter === "student"} onClick={() => setSubjectsFilter("student")} selected={subjectsFilter === "student"} icon={GraduationCap} count={subjectCounts.student}>Student</FilterButton>
            <FilterButton active={subjectsFilter === "elev"} onClick={() => setSubjectsFilter("elev")} selected={subjectsFilter === "elev"} icon={School} count={subjectCounts.elev}>Elev</FilterButton>
            <FilterButton active={subjectsFilter === "unassigned"} onClick={() => setSubjectsFilter("unassigned")} selected={subjectsFilter === "unassigned"} icon={XCircle} count={subjectCounts.unassigned}>Fara alocari</FilterButton>
          </AdminTabsContainer>
          <SearchInput value={subjectsSearch} onChange={setSubjectsSearch} placeholder="Cauta materie, id, fisier sau creator" />
        </div>

        <div className="admin-inline-stats">
          <span className="status-pill is-muted">{`${subjectsData.totalSubjects} materii`}</span>
          <span className="status-pill is-muted">{`${subjectsData.totalAllocations} alocari`}</span>
        </div>

        {filteredSubjects.length ? (
          <>
            <AdminTable minWidth={1260} columns={[
              { key: "title", label: "Materie" },
              { key: "id", label: "ID" },
              { key: "questions", label: "Fisier intrebari" },
              { key: "allocations", label: "Numar alocari", align: "center" },
              { key: "contexts", label: "Tipuri context" },
              { key: "creator", label: "Creat de" },
              { key: "createdAt", label: "Creat la" }
            ]}>
              {subjectsPageData.rows.map((subject) => (
                <tr key={subject.id}>
                  <td className="admin-table-name-cell admin-table-name-cell--xl">{subject.title}</td>
                  <td className="admin-table-code-cell">{subject.id}</td>
                  <td className="admin-table-text-cell admin-table-wide-cell admin-table-wide-cell--xl">{subject.questions_file || "Fara fisier"}</td>
                  <td className="table-center admin-table-count-cell">{subject.allocation_count}</td>
                  <td>
                    <div className="admin-cell-pill-list">
                      {subject.contexts.length ? subject.contexts.map((context) => (
                        <CellPill key={`${subject.id}-${context}`}>{context === "elev" ? "Elev" : "Student"}</CellPill>
                      )) : <CellPill tone="warning">Fara alocari</CellPill>}
                    </div>
                  </td>
                  <td className="admin-table-text-cell">{subject.created_by_email || subject.source}</td>
                  <td><TableDate value={subject.created_at} /></td>
                </tr>
              ))}
            </AdminTable>
            <PaginationControls page={subjectsPageData.page} totalPages={subjectsPageData.totalPages} onChange={setSubjectsPage} />
          </>
        ) : (
          <EmptyState title="Nu exista materii pentru filtrul ales." subtitle="Schimba filtrul sau revino mai tarziu." />
        )}
      </section>

      <section className={`surface admin-panel ${section === "academic" ? "is-visible" : "is-hidden"}`} aria-hidden={section !== "academic"}>
        <div className="dashboard-header admin-section-intro">
          <div>
            <h2>Structura academica</h2>
            <p className="page-copy">Vezi institutiile si facultatile existente, plus dependintele lor principale in comunitate.</p>
          </div>
          <span className="status-pill is-muted">{`${academicData.counts.programs} programe · ${academicData.counts.cohorts} grupe`}</span>
        </div>

        <div className="admin-toolbar admin-toolbar--academic">
          <AdminTabsContainer role="group" aria-label="Subsectiuni structura academica">
            <FilterButton active={academicSubtab === "institutions"} onClick={() => setAcademicSubtab("institutions")} selected={academicSubtab === "institutions"} icon={Building2} count={academicCounts.institutions}>Institutii</FilterButton>
            <FilterButton active={academicSubtab === "faculties"} onClick={() => setAcademicSubtab("faculties")} selected={academicSubtab === "faculties"} icon={GraduationCap} count={academicCounts.faculties}>Facultati</FilterButton>
          </AdminTabsContainer>

          {academicSubtab === "institutions" ? (
            <SearchInput value={institutionsSearch} onChange={setInstitutionsSearch} placeholder="Cauta institutie, oras sau sursa" />
          ) : (
            <SearchInput value={facultiesSearch} onChange={setFacultiesSearch} placeholder="Cauta facultate, institutie sau tip unitate" />
          )}
        </div>

        {academicSubtab === "institutions" ? (
          <TableSection
            title="Institutii"
            subtitle="Vezi cate facultati, grupe si memberships are fiecare institutie."
            count={filteredInstitutions.length}
            variant="flat"
          >
            {filteredInstitutions.length ? (
              <>
                <AdminTable minWidth={1260} columns={[
                  { key: "name", label: "Nume" },
                  { key: "type", label: "Tip" },
                  { key: "city", label: "Oras" },
                  { key: "source", label: "Sursa" },
                  { key: "faculties", label: "Numar facultati", align: "center" },
                  { key: "cohorts", label: "Numar cohorte/grupe", align: "center" },
                  { key: "memberships", label: "Numar utilizatori / memberships", align: "center" },
                  { key: "createdAt", label: "Creat la" }
                ]}>
                  {institutionsPageData.rows.map((institution) => (
                    <tr key={institution.id}>
                      <td className="admin-table-name-cell admin-table-name-cell--xxl">
                        <button type="button" className="admin-table-link inline-text-action" onClick={() => jumpToFaculties(institution.id)}>
                          {institution.name}
                        </button>
                      </td>
                      <td><CellPill>{institution.type === "school" ? "School" : "University"}</CellPill></td>
                      <td>{institution.city}</td>
                      <td>{institution.source}</td>
                      <td className="table-center admin-table-count-cell">{institution.faculty_count}</td>
                      <td className="table-center admin-table-count-cell">{institution.cohort_count}</td>
                      <td className="table-center admin-table-count-cell">{institution.membership_count}</td>
                      <td><TableDate value={institution.created_at} /></td>
                    </tr>
                  ))}
                </AdminTable>
                <PaginationControls page={institutionsPageData.page} totalPages={institutionsPageData.totalPages} onChange={setInstitutionsPage} />
              </>
            ) : (
              <EmptyState title="Nu exista institutii disponibile." subtitle="Revino dupa ce apar primele comunitati." />
            )}
          </TableSection>
        ) : (
          <TableSection
            title="Facultati"
            subtitle="Vezi dependintele principale pentru fiecare facultate din structura academica."
            count={filteredFaculties.length}
            variant="flat"
            actions={
              facultyInstitution ? (
                <button type="button" className="btn-link secondary admin-clear-filter" onClick={() => setFacultyInstitution("")}>
                  {`Reset institutie: ${selectedInstitution?.name || "filtru activ"}`}
                </button>
              ) : null
            }
          >
            {filteredFaculties.length ? (
              <>
                <AdminTable minWidth={1320} columns={[
                  { key: "name", label: "Nume" },
                  { key: "institution", label: "Institutie" },
                  { key: "unitType", label: "Tip unitate" },
                  { key: "source", label: "Sursa" },
                  { key: "programs", label: "Numar programe copil", align: "center" },
                  { key: "cohorts", label: "Numar cohorte", align: "center" },
                  { key: "memberships", label: "Numar utilizatori / memberships", align: "center" },
                  { key: "createdAt", label: "Creat la" }
                ]}>
                  {facultiesPageData.rows.map((faculty) => (
                    <tr key={faculty.id}>
                      <td className="admin-table-name-cell admin-table-name-cell--xl">{faculty.name}</td>
                      <td className="admin-table-name-cell admin-table-name-cell--xl">{faculty.institution_name}</td>
                      <td><CellPill>{faculty.unit_type}</CellPill></td>
                      <td>{faculty.source}</td>
                      <td className="table-center admin-table-count-cell">{faculty.program_count}</td>
                      <td className="table-center admin-table-count-cell">{faculty.cohort_count}</td>
                      <td className="table-center admin-table-count-cell">{faculty.membership_count}</td>
                      <td><TableDate value={faculty.created_at} /></td>
                    </tr>
                  ))}
                </AdminTable>
                <PaginationControls page={facultiesPageData.page} totalPages={facultiesPageData.totalPages} onChange={setFacultiesPage} />
              </>
            ) : (
              <EmptyState title="Nu exista facultati disponibile." subtitle="Revino dupa ce sunt create primele unitati academice." />
            )}
          </TableSection>
        )}
      </section>

      <section className={`surface admin-panel ${section === "free-access" ? "is-visible" : "is-hidden"}`} aria-hidden={section !== "free-access"}>
        <div className="dashboard-header admin-section-intro">
          <div>
            <h2>Acces gratuit</h2>
            <p className="page-copy">Adauga colegi pe email pentru acces premium gratuit, fara plata.</p>
          </div>
          <span className="status-pill is-muted">{`${filteredFreeAccessRows.length} rezultate`}</span>
        </div>

        <form className="admin-free-access-form" onSubmit={handleSubmitFreeAccess}>
          <label className="admin-free-access-label" htmlFor="free-access-emails">
            Emailuri (cate unul pe linie)
          </label>
          <textarea
            id="free-access-emails"
            className="admin-free-access-textarea"
            value={freeAccessInput}
            onChange={(event) => setFreeAccessInput(event.target.value)}
            placeholder={"coleg1@email.com\ncoleg2@email.com"}
            rows={6}
          />
          <label className="admin-free-access-label" htmlFor="free-access-notes">
            Nota optionala
          </label>
          <input
            id="free-access-notes"
            type="text"
            value={freeAccessNotes}
            onChange={(event) => setFreeAccessNotes(event.target.value)}
            className="admin-search-input"
            placeholder="Ex: Colegi grupa 401"
          />
          <div className="admin-free-access-actions">
            <button type="submit" className="btn-back" disabled={isSubmittingFreeAccess}>
              <LoadingIconText loading={isSubmittingFreeAccess} loadingLabel="Se salveaza...">
                Adauga lista
              </LoadingIconText>
            </button>
            <span className="micro-copy">Accesul se activeaza automat la primul login.</span>
          </div>
          {freeAccessError ? <p className="admin-inline-error" role="alert">{freeAccessError}</p> : null}
          {freeAccessSuccess ? <p className="admin-inline-success" role="status">{freeAccessSuccess}</p> : null}
        </form>

        <div className="admin-toolbar">
          <div className="admin-inline-stats">
            <span className="status-pill is-muted">{`${freeAccessRows.filter((row) => row.is_active).length} active`}</span>
            <span className="status-pill is-muted">{`${freeAccessRows.length} totale`}</span>
          </div>
          <SearchInput value={freeAccessSearch} onChange={setFreeAccessSearch} placeholder="Cauta email, nota sau admin" />
        </div>

        {filteredFreeAccessRows.length ? (
          <>
            <AdminTable minWidth={1100} columns={[
              { key: "email", label: "Email" },
              { key: "status", label: "Status" },
              { key: "grant", label: "Grant" },
              { key: "applied", label: "Activat in cont" },
              { key: "note", label: "Nota" },
              { key: "addedBy", label: "Adaugat de" },
              { key: "createdAt", label: "Creat la" },
              { key: "actions", label: "Actiune" }
            ]}>
              {freeAccessPageData.rows.map((row) => (
                <tr key={row.id}>
                  <td className="admin-table-text-cell">{row.email}</td>
                  <td>
                    <CellPill tone={row.is_active ? "good" : "warning"}>
                      {row.is_active ? "Activ" : "Inactiv"}
                    </CellPill>
                  </td>
                  <td>{row.grant_kind}</td>
                  <td>
                    <CellPill tone={row.grant_applied ? "good" : "warning"}>
                      {row.grant_applied ? "Da" : "In asteptare"}
                    </CellPill>
                  </td>
                  <td className="admin-table-text-cell">{row.notes || "-"}</td>
                  <td className="admin-table-text-cell">{row.added_by_email || row.added_by || "-"}</td>
                  <td><TableDate value={row.created_at} /></td>
                  <td>
                    <button
                      type="button"
                      className="btn-link secondary admin-toggle-btn"
                      onClick={() => handleToggleFreeAccess(row)}
                    >
                      {row.is_active ? "Dezactiveaza" : "Reactiveaza"}
                    </button>
                  </td>
                </tr>
              ))}
            </AdminTable>
            <PaginationControls page={freeAccessPageData.page} totalPages={freeAccessPageData.totalPages} onChange={setFreeAccessPage} />
          </>
        ) : (
          <EmptyState title="Nu exista emailuri pentru filtrul ales." subtitle="Adauga colegii in lista sau schimba cautarea." />
        )}
      </section>

      <section className={`surface admin-panel ${section === "testimonials" ? "is-visible" : "is-hidden"}`} aria-hidden={section !== "testimonials"}>
        <div className="dashboard-header admin-section-intro">
          <div>
            <h2>Testimoniale</h2>
            <p className="page-copy">Aproba review-urile trimise si pregateste recompensa aleasa. Utilizatorul o activeaza cand are nevoie.</p>
          </div>
          <span className="status-pill is-muted">{`${filteredTestimonials.length} rezultate`}</span>
        </div>

        <div className="admin-toolbar">
          <AdminTabsContainer className="admin-filter-row" role="group" aria-label="Filtre testimoniale">
            <FilterButton active={testimonialsFilter === "all"} onClick={() => setTestimonialsFilter("all")} selected={testimonialsFilter === "all"} icon={Star} count={testimonialCounts.all}>Toate</FilterButton>
            <FilterButton active={testimonialsFilter === "pending"} onClick={() => setTestimonialsFilter("pending")} selected={testimonialsFilter === "pending"} icon={Clock} count={testimonialCounts.pending} actionCount={visibleAdminActionSummary.testimonials || 0}>In asteptare</FilterButton>
            <FilterButton active={testimonialsFilter === "approved"} onClick={() => setTestimonialsFilter("approved")} selected={testimonialsFilter === "approved"} icon={CheckCircle2} count={testimonialCounts.approved}>Aprobate</FilterButton>
            <FilterButton active={testimonialsFilter === "rejected"} onClick={() => setTestimonialsFilter("rejected")} selected={testimonialsFilter === "rejected"} icon={XCircle} count={testimonialCounts.rejected}>Respinse</FilterButton>
          </AdminTabsContainer>
          <SearchInput value={testimonialsSearch} onChange={setTestimonialsSearch} placeholder="Cauta email, testimonial sau recompensa" />
        </div>

        <div className="admin-inline-stats">
          <span className="status-pill is-muted">{`${testimonialRows.filter((row) => row.status === "pending").length} in asteptare`}</span>
          <span className="status-pill is-muted">{`${testimonialRows.filter((row) => row.status === "approved").length} aprobate`}</span>
          <span className="status-pill is-muted">{`${testimonialRows.length} totale`}</span>
        </div>

        {testimonialActionError ? <p className="admin-inline-error" role="alert">{testimonialActionError}</p> : null}
        {testimonialActionSuccess ? <p className="admin-inline-success" role="status">{testimonialActionSuccess}</p> : null}

        {filteredTestimonials.length ? (
          <>
            <AdminTable minWidth={1320} columns={[
              { key: "review", label: "" },
              { key: "status", label: "Status" },
              { key: "email", label: "Email" },
              { key: "reward", label: "Recompensa" },
              { key: "testimonial", label: "Testimonial" },
              { key: "sentAt", label: "Trimis la" },
              { key: "rewardedAt", label: "Recompensa" },
              { key: "actions", label: "Actiuni" }
            ]}>
              {testimonialsPageData.rows.map((row) => (
                <tr key={row.id} className={row.status === "pending" ? "has-admin-review" : undefined}>
                  <td className="admin-review-cell">
                    <ReviewDot show={row.status === "pending"} label="Testimonial de aprobat" />
                  </td>
                  <td>
                    <CellPill tone={row.status === "approved" ? "good" : row.status === "rejected" ? "bad" : "warning"}>
                      {row.status === "approved" ? "Aprobat" : row.status === "rejected" ? "Respins" : "In asteptare"}
                    </CellPill>
                  </td>
                  <td className="admin-table-text-cell">{row.user_email || row.user_id || "-"}</td>
                  <td>{testimonialRewardLabel(row.reward_type)}</td>
                  <td className="admin-table-text-cell admin-table-wide-cell admin-testimonial-cell">
                    {row.public_testimonial || row.edited_testimonial}
                  </td>
                  <td><TableDate value={row.created_at} /></td>
                  <td>
                    {row.reward_granted_at ? (
                      <CellPill tone="good">Activata</CellPill>
                    ) : row.status === "approved" ? (
                      <CellPill tone="warning">Gata de activat</CellPill>
                    ) : (
                      <CellPill tone="warning">In asteptare</CellPill>
                    )}
                  </td>
                  <td>
                    <div className="admin-testimonial-actions">
                      {row.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            className="btn-link secondary admin-toggle-btn"
                            onClick={() => handleTestimonialAction(row, "approve")}
                            disabled={updatingTestimonialId === row.id}
                          >
                            Aproba
                          </button>
                          <button
                            type="button"
                            className="btn-link secondary admin-toggle-btn"
                            onClick={() => handleTestimonialAction(row, "reject")}
                            disabled={updatingTestimonialId === row.id}
                          >
                            Respinge
                          </button>
                        </>
                      ) : (
                        <span className="micro-copy">{row.admin_note || "-"}</span>
                      )}
                      <button
                        type="button"
                        className="btn-link secondary admin-toggle-btn"
                        onClick={() => handleTestimonialDelete(row)}
                        disabled={updatingTestimonialId === row.id}
                        title="Sterge reviewul si permite utilizatorului sa trimita din nou"
                      >
                        <Trash2 aria-hidden="true" size={15} />
                        Reset
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTable>
            <PaginationControls page={testimonialsPageData.page} totalPages={testimonialsPageData.totalPages} onChange={setTestimonialsPage} />
          </>
        ) : (
          <EmptyState title="Nu exista testimoniale pentru filtrul ales." subtitle="Cand un utilizator trimite review, apare aici pentru aprobare." />
        )}
      </section>
    </>
  );
}
