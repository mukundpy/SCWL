import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  RefreshCw,
  Trash2,
  Search,
  Copy,
  Check,
  Play,
  Clock,
  Calendar,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Code2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import clsx from "clsx";
import { api, qs } from "@/lib/api";
import type { SqlQueryEntry, SqlHistoryResponse } from "@/lib/types";
import { Card, PageHeader, Button, Input, Empty, Spinner, Confirm } from "@/components/ui";

function typeBadge(type: SqlQueryEntry["type"]) {
  const styles: Record<string, string> = {
    CALL: "bg-purple-100 text-purple-700 border-purple-200",
    SELECT: "bg-slate-100 text-slate-700 border-slate-200",
    INSERT: "bg-emerald-100 text-emerald-700 border-emerald-200",
    UPDATE: "bg-blue-100 text-blue-700 border-blue-200",
    DELETE: "bg-red-100 text-red-700 border-red-200",
    DDL: "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide",
        styles[type] || "bg-slate-100 text-slate-700 border-slate-200"
      )}
    >
      {type}
    </span>
  );
}

function CopyButton({ text, label = "Copy SQL" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title={label}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

function formatRelativeTime(isoString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    const min = Math.floor(diff / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  } catch {
    return "";
  }
}

export default function SqlHistory() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [expandedParams, setExpandedParams] = useState<Record<string, boolean>>({});

  // Interactive Query Runner state
  const [showRunner, setShowRunner] = useState(false);
  const [testSql, setTestSql] = useState("SELECT * FROM vw_Shipment_Details LIMIT 5;");
  const [runResult, setRunResult] = useState<any>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Auto-refresh interval
  const { data, isLoading, isFetching, refetch } = useQuery<SqlHistoryResponse>({
    queryKey: ["sql-history", selectedType, search],
    queryFn: () =>
      api.get<SqlHistoryResponse>(
        `/sql-history${qs({
          limit: 150,
          type: selectedType === "ALL" ? undefined : selectedType,
          search: search || undefined,
        })}`
      ),
    refetchInterval: autoRefresh ? 3000 : false,
  });

  const clearMutation = useMutation({
    mutationFn: () => api.del<{ ok: boolean; cleared: number }>("/sql-history"),
    onSuccess: () => {
      setShowConfirmClear(false);
      queryClient.invalidateQueries({ queryKey: ["sql-history"] });
    },
  });

  const executeMutation = useMutation({
    mutationFn: (sql: string) =>
      api.post<{ ok: boolean; result: any }>("/sql-history/execute", { sql }),
    onSuccess: (res) => {
      setRunResult(res.result);
      setRunError(null);
      queryClient.invalidateQueries({ queryKey: ["sql-history"] });
    },
    onError: (err: any) => {
      setRunError(err?.message || "Execution failed");
      setRunResult(null);
      queryClient.invalidateQueries({ queryKey: ["sql-history"] });
    },
  });

  const toggleParams = (id: string) => {
    setExpandedParams((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const queries = data?.queries || [];
  const stats = data?.stats || {
    total: 0,
    SELECT: 0,
    INSERT: 0,
    UPDATE: 0,
    DELETE: 0,
    CALL: 0,
    OTHER: 0,
  };

  const filterTabs = [
    { key: "ALL", label: "All", count: stats.total },
    { key: "CALL", label: "CALL (Procedures)", count: stats.CALL },
    { key: "SELECT", label: "SELECT (Views & Tables)", count: stats.SELECT },
    { key: "INSERT", label: "INSERT", count: stats.INSERT },
    { key: "UPDATE", label: "UPDATE", count: stats.UPDATE },
    { key: "DELETE", label: "DELETE", count: stats.DELETE },
  ];

  const quickSamples = [
    { label: "Shipments View", sql: "SELECT * FROM vw_Shipment_Details LIMIT 5;" },
    { label: "Products Catalog", sql: "SELECT product_id, sku, product_name, unit_price FROM Products LIMIT 5;" },
    { label: "Low Stock Alerts", sql: "SELECT * FROM vw_Low_Stock_Alerts;" },
    { label: "Warehouse Utilization", sql: "SELECT * FROM vw_Warehouse_Utilization;" },
    { label: "Recent Movements", sql: "SELECT * FROM Stock_Movements ORDER BY movement_id DESC LIMIT 5;" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="SQL Queries History"
        subtitle="Live audit trail of every SQL statement executed against the database with timestamps and execution details."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Auto refresh switch */}
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={clsx(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                autoRefresh
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
              title={autoRefresh ? "Auto-refreshing every 3s" : "Auto-refresh paused"}
            >
              <span
                className={clsx(
                  "h-2 w-2 rounded-full",
                  autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                )}
              />
              {autoRefresh ? "Live: 3s" : "Live: Paused"}
            </button>

            {/* Manual refresh button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh now"
            >
              <RefreshCw className={clsx("h-3.5 w-3.5", isFetching && "animate-spin")} />
              <span>Refresh</span>
            </Button>

            {/* Query Runner toggle button */}
            <Button
              variant={showRunner ? "primary" : "secondary"}
              size="sm"
              onClick={() => setShowRunner((v) => !v)}
            >
              <Play className="h-3.5 w-3.5" />
              <span>{showRunner ? "Hide Query Runner" : "Run Test SQL"}</span>
            </Button>

            {/* Clear button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirmClear(true)}
              disabled={stats.total === 0}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear History</span>
            </Button>
          </div>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Logged</span>
            <Database className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
            {stats.total}
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>CALL (Procedures)</span>
            <span className="h-2 w-2 rounded-full bg-purple-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-purple-700">
            {stats.CALL}
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>SELECT Queries</span>
            <span className="h-2 w-2 rounded-full bg-slate-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-800">
            {stats.SELECT}
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>INSERT (DML)</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-emerald-700">
            {stats.INSERT}
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>UPDATE (DML)</span>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-blue-700">
            {stats.UPDATE}
          </div>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>DELETE (DML)</span>
            <span className="h-2 w-2 rounded-full bg-red-500" />
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-red-700">
            {stats.DELETE}
          </div>
        </Card>
      </div>

      {/* Interactive Query Runner Panel (collapsible) */}
      {showRunner && (
        <Card className="border-indigo-100 bg-indigo-50/40 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-indigo-600" />
              <h2 className="font-semibold text-slate-900">Execute Test SQL</h2>
            </div>
            <span className="text-xs text-slate-500">
              Run any SQL directly — it will be executed on the DB and recorded in history
            </span>
          </div>

          {/* Quick sample chips */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="text-xs text-slate-500 py-1 mr-1">Samples:</span>
            {quickSamples.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setTestSql(s.sql)}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 transition"
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <textarea
              value={testSql}
              onChange={(e) => setTestSql(e.target.value)}
              rows={3}
              placeholder="Enter SQL statement here (e.g. SELECT * FROM Products;)"
              className="w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-emerald-300 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Supports SELECT, CALL procedures, INSERT, UPDATE, DELETE.
              </div>
              <Button
                size="sm"
                variant="primary"
                loading={executeMutation.isPending}
                disabled={!testSql.trim()}
                onClick={() => executeMutation.mutate(testSql.trim())}
              >
                <Play className="h-3.5 w-3.5" />
                <span>Run Statement</span>
              </Button>
            </div>

            {/* Error output */}
            {runError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <strong>Error:</strong> {runError}
              </div>
            )}

            {/* Result output */}
            {runResult && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600">
                  <span>
                    Query Result:{" "}
                    {Array.isArray(runResult)
                      ? `${runResult.length} row${runResult.length !== 1 ? "s" : ""}`
                      : "Executed successfully"}
                  </span>
                  <button
                    onClick={() => setRunResult(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    Dismiss
                  </button>
                </div>
                <pre className="max-h-56 overflow-auto rounded bg-slate-900 p-2.5 font-mono text-[11px] text-emerald-300">
                  {JSON.stringify(runResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Filter Chips & Search Bar */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Query Type tabs */}
          <div className="flex flex-wrap gap-1.5">
            {filterTabs.map((tab) => {
              const active = selectedType === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSelectedType(tab.key)}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition",
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={clsx(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      active ? "bg-indigo-700 text-indigo-100" : "bg-white text-slate-600"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search box */}
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SQL, table, or timestamp..."
              className="h-9 pl-9 text-xs"
            />
          </div>
        </div>
      </Card>

      {/* Queries List */}
      {isLoading ? (
        <Spinner />
      ) : queries.length === 0 ? (
        <Empty
          title="No SQL queries found"
          hint={
            search || selectedType !== "ALL"
              ? "Try clearing your search or filter to see more queries."
              : "Perform actions like browsing Dashboard, Inventory, creating Shipments, or click 'Run Test SQL' above to see queries logged here."
          }
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch("");
                setSelectedType("ALL");
              }}
            >
              Reset Filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {queries.map((q) => {
            const hasParams = Array.isArray(q.params) && q.params.length > 0;
            const isParamsExpanded = !!expandedParams[q.id];

            return (
              <Card
                key={q.id}
                className={clsx(
                  "overflow-hidden transition hover:shadow-md",
                  q.status === "error" && "border-red-200"
                )}
              >
                {/* Header bar of query card */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {typeBadge(q.type)}

                    {/* Status badge */}
                    {q.status === "success" ? (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-red-700 bg-red-50 border border-red-200">
                        <AlertTriangle className="h-3 w-3" />
                        Failed
                      </span>
                    )}

                    {/* Duration badge */}
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                      <Zap className="h-3 w-3 text-amber-500" />
                      {q.durationMs} ms
                    </span>

                    {/* Rows affected / count */}
                    {typeof q.rowsCount === "number" && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        • {q.rowsCount} row{q.rowsCount !== 1 ? "s" : ""} returned
                      </span>
                    )}
                    {typeof q.affectedRows === "number" && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        • {q.affectedRows} row{q.affectedRows !== 1 ? "s" : ""} affected
                      </span>
                    )}
                  </div>

                  {/* Timestamp and Date */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium text-slate-700">{q.date}</span>
                      <Clock className="ml-1 h-3.5 w-3.5 text-slate-400" />
                      <span className="font-mono text-slate-700">{q.time}</span>
                      {q.timestamp && (
                        <span className="ml-1 rounded bg-slate-200/60 px-1 py-0.2 text-[10px] text-slate-600">
                          {formatRelativeTime(q.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* SQL Code Block */}
                <div className="bg-slate-900 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
                      Executed SQL Statement
                    </span>
                    <div className="flex items-center gap-2">
                      {hasParams && (
                        <button
                          onClick={() => toggleParams(q.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                        >
                          <span>Parameters ({q.params.length})</span>
                          {isParamsExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      )}
                      <CopyButton text={q.sql} />
                    </div>
                  </div>

                  <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-emerald-300">
                    {q.sql}
                  </pre>

                  {/* Expandable Parameters and Raw Template */}
                  {hasParams && isParamsExpanded && (
                    <div className="mt-3 border-t border-slate-800 pt-3">
                      <div className="mb-1 text-[10px] font-mono text-slate-400 uppercase">
                        Parameterized Template:
                      </div>
                      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-slate-300 mb-2">
                        {q.rawSql}
                      </pre>
                      <div className="text-[10px] font-mono text-slate-400 uppercase">
                        Values:
                      </div>
                      <pre className="overflow-x-auto font-mono text-[11px] text-cyan-300">
                        {JSON.stringify(q.params, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Error display if query had error */}
                  {q.error && (
                    <div className="mt-3 rounded border border-red-500/30 bg-red-950/50 p-2.5 text-xs text-red-300 font-mono">
                      <strong>DB Error:</strong> {q.error}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Clear Confirmation Modal */}
      <Confirm
        open={showConfirmClear}
        onClose={() => setShowConfirmClear(false)}
        onConfirm={() => clearMutation.mutate()}
        title="Clear SQL History"
        message="Are you sure you want to clear all recorded SQL query history? This cannot be undone."
        confirmLabel="Clear All"
        danger
        loading={clearMutation.isPending}
      />
    </div>
  );
}
