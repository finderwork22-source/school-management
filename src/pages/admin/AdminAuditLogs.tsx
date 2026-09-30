import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  FileClock,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

type AuditDateFilter = "all" | "24h" | "7d" | "30d" | "90d" | "custom";

interface SchoolRecord {
  id: string;
  name: string;
}

interface AuditLogRecord {
  id: string;
  admin_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  school_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditRow extends AuditLogRecord {
  school: SchoolRecord | null;
}

const PAGE_SIZE = 50;

const DATE_FILTERS: Array<{ value: AuditDateFilter; label: string }> = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
];

function getDateFilterStart(filter: AuditDateFilter) {
  if (filter === "all" || filter === "custom") return null;

  const date = new Date();
  if (filter === "24h") date.setHours(date.getHours() - 24);
  if (filter === "7d") date.setDate(date.getDate() - 7);
  if (filter === "30d") date.setDate(date.getDate() - 30);
  if (filter === "90d") date.setDate(date.getDate() - 90);
  return date.toISOString();
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDateTime(value);
}

function formatLabel(value: string | null) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replaceAll(".", " · ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatMetadataKey(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function actionClasses(action: string) {
  if (action.includes("approved") || action.includes("activated")) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (action.includes("rejected") || action.includes("deleted") || action.includes("failed")) {
    return "bg-red-50 text-red-700";
  }

  if (action.includes("under_review") || action.includes("updated")) {
    return "bg-indigo-50 text-indigo-700";
  }

  if (action.includes("suspend") || action.includes("past_due")) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-100 text-slate-600";
}

function shortenId(value: string | null) {
  if (!value) return "—";
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function humanizeUserAgent(value: string | null) {
  if (!value) return "Not recorded";
  return value.length > 150 ? `${value.slice(0, 150)}...` : value;
}

function EmptyState({ searchActive }: { searchActive: boolean }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600">
        <FileClock size={20} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-wiser-text">
        {searchActive ? "No audit events match your filters" : "No audit events yet"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-wiser-text-secondary">
        {searchActive
          ? "Try clearing a filter or using a broader search term."
          : "Security-sensitive WISE platform actions will appear here as they are recorded."}
      </p>
    </div>
  );
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [recentCount, setRecentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<AuditDateFilter>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditRow | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const schoolById = useMemo(
    () => new Map(schools.map((school) => [school.id, school])),
    [schools],
  );

  const actionOptions = useMemo(() => {
    const values = Array.from(new Set(logs.map((log) => log.action).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const entityOptions = useMemo(() => {
    const values = Array.from(
      new Set(logs.map((log) => log.entity_type).filter(Boolean)),
    );
    return values.sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const rows = useMemo<AuditRow[]>(
    () => logs.map((log) => ({ ...log, school: log.school_id ? schoolById.get(log.school_id) ?? null : null })),
    [logs, schoolById],
  );

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const searchActive =
    Boolean(search.trim()) ||
    actionFilter !== "all" ||
    entityFilter !== "all" ||
    schoolFilter !== "all" ||
    dateFilter !== "30d" ||
    Boolean(customStart) ||
    Boolean(customEnd);

  async function loadSchools() {
    const { data, error: queryError } = await supabase
      .from("schools")
      .select("id, name")
      .order("name", { ascending: true });

    if (!queryError) {
      setSchools((data ?? []) as SchoolRecord[]);
    }
  }

  async function loadAuditLogs(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const startDate =
        dateFilter === "custom"
          ? customStart
            ? new Date(`${customStart}T00:00:00`).toISOString()
            : null
          : getDateFilterStart(dateFilter);

      const endDate =
        dateFilter === "custom" && customEnd
          ? new Date(`${customEnd}T23:59:59.999`).toISOString()
          : null;

      let query = supabase
        .from("platform_audit_logs")
        .select(
          "id, admin_user_id, action, entity_type, entity_id, school_id, metadata, ip_address, user_agent, created_at",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (actionFilter !== "all") query = query.eq("action", actionFilter);
      if (entityFilter !== "all") query = query.eq("entity_type", entityFilter);
      if (schoolFilter !== "all") query = query.eq("school_id", schoolFilter);
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", endDate);

      const [logResult, recentResult] = await Promise.all([
        query,
        supabase
          .from("platform_audit_logs")
          .select("id", { count: "exact", head: true })
          .gte(
            "created_at",
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          ),
      ]);

      if (logResult.error) throw logResult.error;
      if (recentResult.error) throw recentResult.error;

      setLogs((logResult.data ?? []) as AuditLogRecord[]);
      setTotalCount(logResult.count ?? 0);
      setRecentCount(recentResult.count ?? 0);
    } catch (loadError) {
      console.error("Failed to load WISE audit logs:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load WISE audit logs.",
      );
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadSchools();

    void supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? "");
    });
  }, []);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
      return;
    }

    void loadAuditLogs();
  }, [page, actionFilter, entityFilter, schoolFilter, dateFilter, customStart, customEnd]);

  useEffect(() => {
    setPage(1);
  }, [actionFilter, entityFilter, schoolFilter, dateFilter, customStart, customEnd]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((log) =>
      [
        log.action,
        log.entity_type,
        log.entity_id ?? "",
        log.admin_user_id,
        log.school?.name ?? "",
        JSON.stringify(log.metadata ?? {}),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [rows, search]);

  const summaryLabel = useMemo(() => {
    if (totalCount === 0) return "No events";
    const first = (page - 1) * PAGE_SIZE + 1;
    const last = Math.min(page * PAGE_SIZE, totalCount);
    return `Showing ${first}-${last} of ${totalCount}`;
  }, [page, totalCount]);

  function openDetails(log: AuditRow) {
    setSelectedLog(log);
  }

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(value);
      window.setTimeout(() => setCopiedId(""), 1600);
    } catch {
      setCopiedId("");
    }
  }

  function resetFilters() {
    setSearch("");
    setActionFilter("all");
    setEntityFilter("all");
    setSchoolFilter("all");
    setDateFilter("30d");
    setCustomStart("");
    setCustomEnd("");
    setPage(1);
  }

  const currentPageRows = filteredRows;

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-wiser-600">
            <Activity size={14} />
            WISE platform security
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-wiser-text sm:text-3xl">
            Audit logs
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-wiser-text-secondary">
            Review security-sensitive actions performed across the WISE platform, including who performed them, what changed, and when.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAuditLogs(true)}
          disabled={refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-wiser-border bg-white px-4 text-sm font-semibold text-wiser-text-secondary shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Events in current view"
          value={loading ? "—" : totalCount.toLocaleString()}
          caption={dateFilter === "30d" ? "Last 30 days" : DATE_FILTERS.find((item) => item.value === dateFilter)?.label ?? "Filtered view"}
          icon={FileClock}
        />
        <SummaryCard
          label="Events in last 24 hours"
          value={loading ? "—" : recentCount.toLocaleString()}
          caption="Across the WISE platform"
          icon={Clock3}
        />
        <SummaryCard
          label="Page"
          value={loading ? "—" : `${page} / ${pageCount}`}
          caption={summaryLabel}
          icon={Activity}
        />
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-wiser-border bg-white shadow-sm">
        <div className="border-b border-wiser-border p-4 sm:p-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_180px_180px_220px_170px_auto]">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search action, entity, school, ID..."
                className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none transition focus:border-wiser-400 focus:ring-2 focus:ring-wiser-100"
              />
            </div>

            <SelectField
              value={actionFilter}
              onChange={setActionFilter}
              options={[
                { value: "all", label: "All actions" },
                ...actionOptions.map((value) => ({ value, label: formatLabel(value) })),
              ]}
            />

            <SelectField
              value={entityFilter}
              onChange={setEntityFilter}
              options={[
                { value: "all", label: "All entities" },
                ...entityOptions.map((value) => ({ value, label: formatLabel(value) })),
              ]}
            />

            <SelectField
              value={schoolFilter}
              onChange={setSchoolFilter}
              options={[
                { value: "all", label: "All schools" },
                ...schools.map((school) => ({ value: school.id, label: school.name })),
              ]}
            />

            <SelectField
              value={dateFilter}
              onChange={(value) => setDateFilter(value as AuditDateFilter)}
              options={DATE_FILTERS}
            />

            <button
              type="button"
              onClick={resetFilters}
              disabled={!searchActive}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Filter size={15} />
              Clear
            </button>
          </div>

          {dateFilter === "custom" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-500">
                From
                <div className="relative mt-1.5">
                  <CalendarDays
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="date"
                    value={customStart}
                    onChange={(event) => setCustomStart(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-wiser-400 focus:ring-2 focus:ring-wiser-100"
                  />
                </div>
              </label>

              <label className="text-xs font-medium text-slate-500">
                To
                <div className="relative mt-1.5">
                  <CalendarDays
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(event) => setCustomEnd(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-wiser-400 focus:ring-2 focus:ring-wiser-100"
                  />
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                {[
                  "Event",
                  "Admin",
                  "School",
                  "Entity",
                  "When",
                  "Details",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-wiser-text-muted"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-500">
                    Loading audit events...
                  </td>
                </tr>
              ) : currentPageRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState searchActive={searchActive} />
                  </td>
                </tr>
              ) : (
                currentPageRows.map((log) => (
                  <tr key={log.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${actionClasses(log.action)}`}
                      >
                        {formatLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-mono text-xs font-medium text-slate-700">
                        {log.admin_user_id === currentUserId ? "Current admin" : shortenId(log.admin_user_id)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">{log.admin_user_id}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {log.school?.name ?? "Platform-wide"}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-700">{formatLabel(log.entity_type)}</p>
                      {log.entity_id && (
                        <p className="mt-1 font-mono text-[11px] text-slate-400">{shortenId(log.entity_id)}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <p className="text-sm text-slate-700">{formatRelativeTime(log.created_at)}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(log.created_at)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => openDetails(log)}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-wiser-200 hover:bg-wiser-50 hover:text-wiser-700"
                      >
                        <Eye size={14} />
                        View details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500">
              Loading audit events...
            </div>
          ) : currentPageRows.length === 0 ? (
            <EmptyState searchActive={searchActive} />
          ) : (
            currentPageRows.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => openDetails(log)}
                className="block w-full px-4 py-4 text-left transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className={`inline-flex max-w-full rounded-full px-2.5 py-1 text-[10px] font-semibold ${actionClasses(log.action)}`}
                    >
                      <span className="truncate">{formatLabel(log.action)}</span>
                    </span>
                    <p className="mt-3 truncate text-sm font-semibold text-slate-800">
                      {log.school?.name ?? "Platform-wide"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatLabel(log.entity_type)} · {formatRelativeTime(log.created_at)}
                    </p>
                  </div>
                  <ChevronRight size={17} className="mt-1 shrink-0 text-slate-300" />
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-wiser-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs text-slate-500">{summaryLabel}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <span className="min-w-16 text-center text-xs font-semibold text-slate-600">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={page >= pageCount || loading}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {selectedLog && (
        <AuditDetailsModal
          log={selectedLog}
          currentUserId={currentUserId}
          copiedId={copiedId}
          onCopy={copyValue}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  caption,
  icon: Icon,
}: {
  label: string;
  value: string;
  caption: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-xl border border-wiser-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600">
          <Icon size={18} />
        </div>
        <ShieldCheck size={17} className="text-slate-300" />
      </div>
      <p className="mt-5 text-xs font-medium text-wiser-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-wiser-text">{value}</p>
      <p className="mt-1 text-xs text-wiser-text-secondary">{caption}</p>
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-wiser-400 focus:ring-2 focus:ring-wiser-100"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function AuditDetailsModal({
  log,
  currentUserId,
  copiedId,
  onCopy,
  onClose,
}: {
  log: AuditRow;
  currentUserId: string;
  copiedId: string;
  onCopy: (value: string) => Promise<void>;
  onClose: () => void;
}) {
  const metadataEntries = Object.entries(log.metadata ?? {});

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-wiser-600">
              Audit event
            </p>
            <h2 className="mt-2 truncate text-lg font-semibold text-slate-900">
              {formatLabel(log.action)}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{formatDateTime(log.created_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoBlock label="Admin user">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-xs text-slate-700">
                  {log.admin_user_id}
                </span>
                <button
                  type="button"
                  onClick={() => void onCopy(log.admin_user_id)}
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Copy admin user ID"
                >
                  {copiedId === log.admin_user_id ? (
                    <ShieldCheck size={14} />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
              {log.admin_user_id === currentUserId && (
                <p className="mt-1 text-[11px] font-medium text-emerald-600">Current authenticated admin</p>
              )}
            </InfoBlock>

            <InfoBlock label="School">
              <p className="text-sm text-slate-700">{log.school?.name ?? "Platform-wide"}</p>
              {log.school_id && (
                <p className="mt-1 font-mono text-[11px] text-slate-400">{log.school_id}</p>
              )}
            </InfoBlock>

            <InfoBlock label="Entity">
              <p className="text-sm text-slate-700">{formatLabel(log.entity_type)}</p>
              {log.entity_id && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="truncate font-mono text-[11px] text-slate-400">{log.entity_id}</span>
                  <button
                    type="button"
                    onClick={() => void onCopy(log.entity_id ?? "")}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Copy entity ID"
                  >
                    {copiedId === log.entity_id ? <ShieldCheck size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              )}
            </InfoBlock>

            <InfoBlock label="Event ID">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-xs text-slate-700">{log.id}</span>
                <button
                  type="button"
                  onClick={() => void onCopy(log.id)}
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Copy event ID"
                >
                  {copiedId === log.id ? <ShieldCheck size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </InfoBlock>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-wiser-600" />
                <h3 className="text-sm font-semibold text-slate-800">Event context</h3>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {metadataEntries.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">No additional metadata recorded.</p>
              ) : (
                metadataEntries.map(([key, value]) => (
                  <div key={key} className="grid gap-2 px-4 py-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {formatMetadataKey(key)}
                    </p>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-700">
                      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoBlock label="IP address">
              <p className="font-mono text-xs text-slate-700">{log.ip_address ?? "Not recorded"}</p>
            </InfoBlock>
            <InfoBlock label="User agent">
              <p className="text-xs leading-5 text-slate-700">{humanizeUserAgent(log.user_agent)}</p>
            </InfoBlock>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-wiser-600" />
              <div>
                <p className="text-xs font-semibold text-slate-800">Audit record is read-only</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Audit entries are presented from the platform audit log and are not editable from this screen.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-wiser-600 px-4 text-sm font-semibold text-white transition hover:bg-wiser-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <div className="mt-2 min-w-0">{children}</div>
    </div>
  );
}
