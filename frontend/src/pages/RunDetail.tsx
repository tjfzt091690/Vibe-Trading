import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Code2,
  Database,
  Download,
  FileCheck2,
  Fingerprint,
  List,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, type BacktestMetrics, type RunCard, type RunData } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { EquityChart } from "@/components/charts/EquityChart";
import { MultiSymbolOverlayChart } from "@/components/charts/MultiSymbolOverlayChart";
import { MetricsCard } from "@/components/chat/MetricsCard";
import { ValidationPanel } from "@/components/charts/ValidationPanel";
import { Skeleton, SkeletonMetrics, SkeletonChart } from "@/components/common/Skeleton";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

const rehypePlugins = [rehypeHighlight];

type Tab = "chart" | "trades" | "runCard" | "code" | "validation";

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsvField(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildTradesCsv(trades: Array<Record<string, string>>): string {
  if (trades.length === 0) return "";
  const keys = [...new Set(trades.flatMap(Object.keys))];
  const header = keys.map(escapeCsvField).join(",");
  const rows = trades.map(tr => keys.map(k => escapeCsvField(tr[k])).join(","));
  return [header, ...rows].join("\n");
}

function buildMetricsCsv(metrics: BacktestMetrics): string {
  const header = "metric,value";
  const rows = Object.entries(metrics).map(([k, v]) => `${escapeCsvField(k)},${escapeCsvField(v)}`);
  return [header, ...rows].join("\n");
}

export function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<RunData | null>(null);
  const [code, setCode] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("chart");
  const [loading, setLoading] = useState(true);

  const hasValidation = !!run?.validation;
  const hasRunCard = !!run?.run_card;
  const TABS: { id: Tab; label: string; icon: typeof BarChart3; hidden?: boolean }[] = [
    { id: "chart", label: "图表", icon: BarChart3 },
    { id: "trades", label: "交易", icon: List },
    { id: "validation", label: "验证", icon: ShieldCheck, hidden: !hasValidation },
    { id: "runCard", label: "运行卡片", icon: FileCheck2, hidden: !hasRunCard },
    { id: "code", label: "代码", icon: Code2 },
  ];

  useEffect(() => {
    if (!runId) return;
    Promise.all([
      api.getRun(runId).catch(() => null),
      api.getRunCode(runId).catch(() => ({})),
    ]).then(([r, c]) => { setRun(r); setCode(c || {}); }).finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-6 w-48" />
        <SkeletonMetrics />
        <SkeletonChart height={400} />
      </div>
    );
  }
  if (!run) return <div className="p-8 text-red-500">未找到运行记录</div>;

  const ok = run.status === "success";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4 space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="返回"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {ok ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-danger" />}
          <h1 className="font-mono text-sm font-medium">{runId}</h1>
          {run.elapsed_seconds && <span className="text-xs text-muted-foreground">{run.elapsed_seconds.toFixed(1)}s</span>}
        </div>
        {run.prompt && <p className="text-sm text-muted-foreground">{run.prompt}</p>}
        {run.metrics && <MetricsCard metrics={run.metrics as Record<string, number>} />}

        <div className="flex items-center gap-1">
          {TABS.filter(t => !t.hidden).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}

          <div className="ml-auto flex gap-1">
            {run.trade_log && run.trade_log.length > 0 && (
              <button
                onClick={() => downloadCsv(`trades_${runId}.csv`, buildTradesCsv(run.trade_log!))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
                title="下载交易 CSV"
              >
                <Download className="h-3.5 w-3.5" /> 下载交易 CSV
              </button>
            )}
            {run.metrics && (
              <button
                onClick={() => downloadCsv(`metrics_${runId}.csv`, buildMetricsCsv(run.metrics!))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
                title="下载指标 CSV"
              >
                <Download className="h-3.5 w-3.5" /> 下载指标 CSV
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <ErrorBoundary>
          {tab === "chart" && <ChartTab run={run} />}
          {tab === "trades" && <TradesTab run={run} />}
          {tab === "validation" && run.validation && <ValidationPanel data={run.validation} />}
          {tab === "runCard" && run.run_card && <RunCardTab card={run.run_card} />}
          {tab === "code" && <CodeTab code={code} />}
        </ErrorBoundary>
      </div>
    </div>
  );
}

function RunCardTab({ card }: { card: RunCard }) {
  const backtest = card.backtest || {};
  const reproducibility = card.reproducibility || {};
  const metrics = card.metrics || {};
  const artifacts = card.artifacts || [];
  const warnings = card.warnings || [];
  const dataSources = card.data_sources || [];

  return (
    <div className="p-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <RunCardStat label="Schema" value={card.schema_version || "unknown"} />
        <RunCardStat label="生成时间" value={formatRunCardValue(card.generated_at)} />
        <RunCardStat label="数据源" value={dataSources.length ? dataSources.join(", ") : "无记录"} />
        <RunCardStat label="警告" value={String(warnings.length)} tone={warnings.length ? "warning" : "normal"} />
      </div>

      {warnings.length > 0 && (
        <section className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            警告
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
          </ul>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <RunCardPanel title="回测摘要" icon={Database}>
          <KeyValueTable data={backtest} empty="无回测摘要记录。" />
        </RunCardPanel>
        <RunCardPanel title="可复现性" icon={Fingerprint}>
          <KeyValueTable data={reproducibility} empty="无可复现性哈希记录。" monospaceValues />
        </RunCardPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RunCardPanel title="指标" icon={BarChart3}>
          <KeyValueTable data={metrics} empty="无标量指标记录。" />
        </RunCardPanel>
        <RunCardPanel title="验证" icon={ShieldCheck}>
          {card.validation ? (
            <pre className="max-h-80 overflow-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed">
              {JSON.stringify(card.validation, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">无验证载荷记录。</p>
          )}
        </RunCardPanel>
      </div>

      <RunCardPanel title="产物校验" icon={FileCheck2}>
        {artifacts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Path</th>
                  <th className="py-2 pr-4">Size</th>
                  <th className="py-2">SHA-256</th>
                </tr>
              </thead>
              <tbody>
                {artifacts.map((artifact) => (
                  <tr key={`${artifact.path}-${artifact.sha256}`} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{artifact.path}</td>
                    <td className="py-2 pr-4 tabular-nums text-muted-foreground">{formatBytes(artifact.size_bytes)}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">{shortHash(artifact.sha256)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">无产物校验记录。</p>
        )}
      </RunCardPanel>
    </div>
  );
}

function RunCardStat({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "warning" }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 truncate text-sm font-medium", tone === "warning" ? "text-amber-700 dark:text-amber-300" : "")}>{value}</div>
    </div>
  );
}

function RunCardPanel({ title, icon: Icon, children }: { title: string; icon: typeof FileCheck2; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </div>
      {children}
    </section>
  );
}

function KeyValueTable({ data, empty, monospaceValues = false }: { data: Record<string, unknown>; empty: string; monospaceValues?: boolean }) {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <table className="w-full table-fixed text-sm">
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key} className="border-b last:border-0">
            <td className="w-36 py-2 pr-4 align-top text-muted-foreground">{key}</td>
            <td className={cn("py-2 align-top", monospaceValues ? "break-all font-mono text-xs" : "break-words text-right tabular-nums")}>{formatRunCardValue(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatRunCardValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(4);
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value ?? "");
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function shortHash(value: string): string {
  return value.length > 16 ? `${value.slice(0, 12)}...${value.slice(-6)}` : value;
}

function ChartTab({ run }: { run: RunData }) {
  const entries = run.price_series ? Object.entries(run.price_series) : [];
  const symbols = entries.map(([sym]) => sym);
  const hasEquity = run.equity_curve && run.equity_curve.length > 0;

  const [selected, setSelected] = useState<Set<string>>(() => {
    if (symbols.length === 0) return new Set<string>();
    if (symbols.length <= 3) return new Set(symbols);
    return new Set([symbols[0]]);
  });
  const [showEquity, setShowEquity] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [exportTargets, setExportTargets] = useState<Set<string>>(() => new Set(symbols));

  if (entries.length === 0 && !hasEquity) {
    return (
      <div className="p-8 text-center text-muted-foreground space-y-2">
        <p className="text-sm">无图表数据</p>
        <p className="text-xs">回测引擎可能未生成价格数据，请检查 artifacts/ 目录。</p>
      </div>
    );
  }

  const toggleSymbol = (sym: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym); else next.add(sym);
      return next;
    });
  };

  const toggleExportTarget = (sym: string) => {
    setExportTargets(prev => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym); else next.add(sym);
      return next;
    });
  };

  const selectedEntries = entries.filter(([sym]) => selected.has(sym));
  const singleEntry = selectedEntries.length === 1 ? selectedEntries[0] : null;

  const handleExportCsv = (includeEquity: boolean) => {
    const rows: string[] = [];
    const targetSyms = symbols.filter(s => exportTargets.has(s));

    if (targetSyms.length > 0) {
      rows.push("time,symbol,open,high,low,close,volume");
      for (const sym of targetSyms) {
        const bars = run.price_series?.[sym];
        if (!bars) continue;
        for (const bar of bars) {
          rows.push(`${bar.time},${sym},${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`);
        }
      }
    }

    if (includeEquity && run.equity_curve && run.equity_curve.length > 0) {
      if (rows.length > 0) rows.push("");
      rows.push("time,equity,drawdown");
      for (const pt of run.equity_curve) {
        rows.push(`${pt.time},${pt.equity},${pt.drawdown}`);
      }
    }

    if (rows.length === 0) return;
    downloadCsv(`chart_data_${run.run_id}.csv`, rows.join("\n"));
    setExportMenu(false);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Symbol multi-select dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowMenu(!showMenu); setExportMenu(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            标的选择 ({selected.size}/{symbols.length})
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {showMenu && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-card border rounded-lg shadow-lg p-2 min-w-[200px] max-h-64 overflow-y-auto" onMouseLeave={() => setShowMenu(false)}>
              <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider px-1 pt-1 pb-1">选择要展示的标的</p>
              {symbols.map(sym => (
                <label key={sym} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(sym)}
                    onChange={() => toggleSymbol(sym)}
                    className="h-3 w-3 rounded accent-primary"
                  />
                  <span className="text-xs font-mono">{sym}</span>
                </label>
              ))}
              <div className="border-t mt-1 pt-1 flex gap-1">
                <button
                  onClick={() => { setSelected(new Set(symbols)); setShowMenu(false); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/30"
                >
                  全选
                </button>
                <button
                  onClick={() => { setSelected(new Set()); setShowMenu(false); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/30"
                >
                  清空
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Equity toggle */}
        {hasEquity && (
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={showEquity}
              onChange={() => setShowEquity(!showEquity)}
              className="h-3 w-3 rounded accent-primary"
            />
            权益曲线
          </label>
        )}

        {/* Export dropdown */}
        <div className="relative ml-auto">
          <button
            onClick={() => { setExportMenu(!exportMenu); setShowMenu(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            导出 CSV
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {exportMenu && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-card border rounded-lg shadow-lg p-2 min-w-[220px]" onMouseLeave={() => setExportMenu(false)}>
              <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider px-1 pt-1 pb-1">选择要导出的数据</p>
              {symbols.map(sym => (
                <label key={sym} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportTargets.has(sym)}
                    onChange={() => toggleExportTarget(sym)}
                    className="h-3 w-3 rounded accent-primary"
                  />
                  <span className="text-xs font-mono">{sym}</span>
                </label>
              ))}
              {hasEquity && (
                <label className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/30 cursor-pointer border-t mt-1 pt-1">
                  <input
                    type="checkbox"
                    checked={exportTargets.has("__equity__")}
                    onChange={() => toggleExportTarget("__equity__")}
                    className="h-3 w-3 rounded accent-primary"
                  />
                  <span className="text-xs">权益曲线</span>
                </label>
              )}
              <div className="border-t mt-1 pt-1 space-y-1">
                <button
                  onClick={() => handleExportCsv(exportTargets.has("__equity__"))}
                  disabled={exportTargets.size === 0 || (exportTargets.size === 1 && exportTargets.has("__equity__") && symbols.length === 0)}
                  className={cn(
                    "w-full text-xs px-2 py-1 rounded transition-colors",
                    exportTargets.size === 0 || (exportTargets.size === 1 && exportTargets.has("__equity__") && symbols.length === 0)
                      ? "text-muted-foreground/40 cursor-not-allowed"
                      : "text-primary hover:bg-primary/10"
                  )}
                >
                  导出已选数据
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart area */}
      {selected.size === 0 && (
        <div className="p-8 text-center text-muted-foreground text-sm">
          请从上方下拉菜单中选择要展示的标的
        </div>
      )}

      {singleEntry && (
        <div>
          <h3 className="text-sm font-medium mb-1">{singleEntry[0]}</h3>
          <CandlestickChart
            data={singleEntry[1]}
            markers={run.trade_markers?.filter(m => m.code === singleEntry[0])}
            indicators={run.indicator_series?.[singleEntry[0]]}
            height={500}
          />
        </div>
      )}

      {selected.size > 1 && (
        <div>
          <h3 className="text-sm font-medium mb-1">多标的叠加（归一化收盘价，基准=100）</h3>
          <MultiSymbolOverlayChart
            series={selectedEntries.map(([sym, bars]) => ({ symbol: sym, data: bars }))}
            height={500}
          />
        </div>
      )}

      {showEquity && hasEquity && (
        <div>
          <h3 className="text-sm font-medium mb-1">权益与回撤</h3>
          <EquityChart data={run.equity_curve!} height={280} />
        </div>
      )}
    </div>
  );
}

function TradesTab({ run }: { run: RunData }) {
  const trades = run.trade_log || [];
  if (trades.length === 0) return <div className="p-8 text-muted-foreground text-sm">无交易记录。</div>;
  return (
    <div className="p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4">时间</th>
            <th className="py-2 pr-4">代码</th>
            <th className="py-2 pr-4">方向</th>
            <th className="py-2 pr-4">价格</th>
            <th className="py-2 pr-4">数量</th>
            <th className="py-2">原因</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((tr, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
              <td className="py-2 pr-4 font-mono text-xs">{tr.time || tr.timestamp}</td>
              <td className="py-2 pr-4">{tr.code}</td>
              <td className={cn("py-2 pr-4 font-medium", tr.side === "BUY" ? "text-success" : "text-danger")}>{tr.side}</td>
              <td className="py-2 pr-4 tabular-nums">{tr.price}</td>
              <td className="py-2 pr-4 tabular-nums">{tr.qty}</td>
              <td className="py-2 text-muted-foreground">{tr.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeTab({ code }: { code: Record<string, string> }) {
  const files = Object.entries(code);
  const [active, setActive] = useState(files[0]?.[0] || "");
  if (files.length === 0) return <div className="p-8 text-muted-foreground text-sm">无代码文件。</div>;
  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 p-2 border-b">
        {files.map(([name]) => (
          <button key={name} onClick={() => setActive(name)} className={cn("px-3 py-1 rounded text-xs font-mono", active === name ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{name}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3 text-[11px] leading-relaxed bg-muted/20 [&_pre]:m-0 [&_pre]:bg-transparent [&_code]:text-[11px]">
        <ReactMarkdown rehypePlugins={rehypePlugins}>
          {`\`\`\`python\n${code[active] || ""}\n\`\`\``}
        </ReactMarkdown>
      </div>
    </div>
  );
}