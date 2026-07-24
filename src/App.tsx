import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { checkForAppUpdate, downloadAndInstallUpdate, fetchClaudeStats, relaunchApp, type ClaudeStats, type ClaudeStatsRange, type UpdateCheckOutcome } from "./lib/tauri";
import type { Update } from "@tauri-apps/plugin-updater";
import { LazyStore } from "@tauri-apps/plugin-store";
import "./App.css";

type ProviderId = "minimax";

type BaseResponse = {
  status_code: number;
  status_msg: string;
};

type ModelRemain = {
  start_time: number;
  end_time: number;
  remains_time: number;
  current_interval_total_count: number;
  current_interval_usage_count: number;
  model_name: string;
  current_weekly_total_count: number;
  current_weekly_usage_count: number;
  weekly_start_time: number;
  weekly_end_time: number;
  weekly_remains_time: number;
  current_interval_status: number;
  current_interval_remaining_percent: number;
  current_weekly_status: number;
  current_weekly_remaining_percent: number;
};

type TokenPlan = {
  model_remains: ModelRemain[];
  base_resp: BaseResponse;
};

type Connection = {
  id: string;
  providerId: ProviderId;
  name: string;
  apiKey: string;
  plan: TokenPlan | null;
  updatedAt: number | null;
  error: string;
};

type PanelMode =
  | { kind: "closed" }
  | { kind: "create"; draft: { provider: ProviderId; connectionName: string; apiKey: string } }
  | { kind: "edit"; id: string; draft: { provider: ProviderId; connectionName: string; apiKey: string } };

type MainView = "overview" | "dashboard";

type IconName =
  | "overview"
  | "plus"
  | "key"
  | "refresh"
  | "sun"
  | "moon"
  | "eye"
  | "eyeOff"
  | "lock"
  | "chevron"
  | "arrow"
  | "check"
  | "alert"
  | "clock"
  | "layers"
  | "external"
  | "trash"
  | "download"
  | "restart";

type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
};

type UpdateFlowState =
  | { kind: "closed" }
  | { kind: "checking" }
  | { kind: "upToDate" }
  | { kind: "available"; update: Update; currentVersion: string; newVersion: string; notes: string | null }
  | { kind: "downloading"; update: Update; currentVersion: string; newVersion: string; downloaded: number; total: number | null }
  | { kind: "ready"; update: Update; currentVersion: string; newVersion: string }
  | { kind: "installing" }
  | { kind: "error"; message: string };

const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";

const providerOptions: Array<{ id: ProviderId; label: string; detail: string }> = [
  { id: "minimax", label: "Minimax", detail: "Coding Plan" },
];

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function Icon({ name, size = 18, strokeWidth = 1.8 }: IconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "overview":
      return (
        <svg {...props}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "key":
      return (
        <svg {...props}>
          <circle cx="8.5" cy="15.5" r="3.5" />
          <path d="m11 13 7.5-7.5M16 7l2 2M14 9l2 2" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...props}>
          <path d="M20 11a8 8 0 0 0-14.8-4L3 9" />
          <path d="M3 4v5h5M4 13a8 8 0 0 0 14.8 4L21 15" />
          <path d="M21 20v-5h-5" />
        </svg>
      );
    case "sun":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2.5v2M12 19.5v2M4.58 4.58l1.42 1.42M18 18l1.42 1.42M2.5 12h2M19.5 12h2M4.58 19.42 6 18M18 6l1.42-1.42" />
        </svg>
      );
    case "moon":
      return (
        <svg {...props}>
          <path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z" />
        </svg>
      );
    case "eye":
      return (
        <svg {...props}>
          <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" />
          <circle cx="12" cy="12" r="2.2" />
        </svg>
      );
    case "eyeOff":
      return (
        <svg {...props}>
          <path d="m3 3 18 18M10.6 6.9A10 10 0 0 1 12 6.8c6 0 9.5 5.2 9.5 5.2a16 16 0 0 1-3.2 3.3M6.2 6.8C3.8 8.2 2.5 12 2.5 12s3.5 5.2 9.5 5.2c1 0 1.9-.1 2.7-.4" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </svg>
      );
    case "lock":
      return (
        <svg {...props}>
          <rect x="4.5" y="10" width="15" height="11" rx="2" />
          <path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14v3" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...props}>
          <path d="m7 9 5 5 5-5" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...props}>
          <path d="M5 12h13M13 6l6 6-6 6" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );
    case "alert":
      return (
        <svg {...props}>
          <path d="M12 3 2.8 19a1.5 1.5 0 0 0 1.3 2.2h15.8a1.5 1.5 0 0 0 1.3-2.2L12 3Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case "clock":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      );
    case "layers":
      return (
        <svg {...props}>
          <path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3Z" />
          <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" />
        </svg>
      );
    case "external":
      return (
        <svg {...props}>
          <path d="M14 4h6v6M20 4l-9 9" />
          <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
        </svg>
      );
    case "trash":
      return (
        <svg {...props}>
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M6 7v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
          <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
        </svg>
      );
    case "download":
      return (
        <svg {...props}>
          <path d="M12 4v12" />
          <path d="m6 11 6 6 6-6" />
          <path d="M5 20h14" />
        </svg>
      );
    case "restart":
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      );
  }
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "—";
  return dateFormatter.format(new Date(timestamp));
}

function formatRange(start: number, end: number): string {
  if (!start || !end) return "时间范围不可用";
  return `${formatDate(start)} — ${formatDate(end)}`;
}

function formatModelName(value: string): string {
  if (!value) return "未命名模型";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeError(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  return "读取失败，请检查 API Key 或稍后重试";
}

function getStatus(percent: number): { label: string; tone: string } {
  if (percent <= 0) return { label: "已用尽", tone: "danger" };
  if (percent <= 20) return { label: "接近上限", tone: "warning" };
  return { label: "运行正常", tone: "success" };
}

type ProviderFormProps = {
  provider: ProviderId;
  connectionName: string;
  apiKey: string;
  keyVisible: boolean;
  loading: boolean;
  error: string;
  compact?: boolean;
  submitLabel?: string;
  onProviderChange: (provider: ProviderId) => void;
  onConnectionNameChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onToggleKey: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
};

function ProviderForm({
  provider,
  connectionName,
  apiKey,
  keyVisible,
  loading,
  error,
  compact = false,
  submitLabel = "连接并查看",
  onProviderChange,
  onConnectionNameChange,
  onApiKeyChange,
  onToggleKey,
  onSubmit,
  onCancel,
}: ProviderFormProps) {
  const providerId = compact ? "provider-empty" : "provider-modal";
  const nameId = compact ? "connection-name-empty" : "connection-name-modal";
  const apiKeyId = compact ? "api-key-empty" : "api-key-modal";

  return (
    <form className={`provider-form${compact ? " provider-form-compact" : ""}`} onSubmit={onSubmit}>
      <div className="form-field">
        <label className="field-label" htmlFor={providerId}>Provider</label>
        <div className="select-wrap">
          <select
            id={providerId}
            value={provider}
            onChange={(event) => onProviderChange(event.target.value as ProviderId)}
          >
            {providerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} · {option.detail}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={15} />
        </div>
      </div>

      <div className="form-field">
        <label className="field-label" htmlFor={nameId}>Coding Plan 名称 <span className="field-hint">可选</span></label>
        <div className="text-input-wrap">
          <Icon name="layers" size={16} />
          <input
            id={nameId}
            type="text"
            value={connectionName}
            onChange={(event) => onConnectionNameChange(event.target.value)}
            placeholder="例如：主力 Coding Plan"
            autoComplete="off"
            maxLength={40}
          />
        </div>
      </div>

      <div className="form-field api-key-field">
        <label className="field-label" htmlFor={apiKeyId}>API Key</label>
        <div className="secret-input-wrap">
          <Icon name="key" size={16} />
          <input
            id={apiKeyId}
            type={keyVisible ? "text" : "password"}
            value={apiKey}
            onChange={(event) => onApiKeyChange(event.target.value)}
            placeholder="sk-cp-..."
            autoComplete="off"
            spellCheck={false}
          />
          <button
            className="field-icon-button"
            type="button"
            onClick={onToggleKey}
            aria-label={keyVisible ? "隐藏 API Key" : "显示 API Key"}
            title={keyVisible ? "隐藏 API Key" : "显示 API Key"}
          >
            <Icon name={keyVisible ? "eyeOff" : "eye"} size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="form-error" role="alert">
          <Icon name="alert" size={15} />
          <span>{error}</span>
        </div>
      )}

      <div className="form-actions">
        {onCancel && (
          <button className="button button-secondary" type="button" onClick={onCancel}>
            取消
          </button>
        )}
        <button className="button button-primary" type="submit" disabled={loading || !apiKey.trim()}>
          {loading ? <span className="button-loading"><span className="spinner" />正在读取</span> : <><span>{submitLabel}</span><Icon name="arrow" size={15} /></>}
        </button>
      </div>
    </form>
  );
}

function UpdateModal({
  flow,
  onClose,
  onDownload,
  onRelaunch,
}: {
  flow: UpdateFlowState;
  onClose: () => void;
  onDownload: () => void;
  onRelaunch: () => void;
}) {
  if (flow.kind === "closed") return null;

  const dismissible = flow.kind !== "downloading" && flow.kind !== "installing";

  const eyebrow = (() => {
    switch (flow.kind) {
      case "checking": return "CHECKING";
      case "upToDate": return "UP TO DATE";
      case "available": return "UPDATE AVAILABLE";
      case "downloading": return "DOWNLOADING";
      case "ready": return "READY TO RESTART";
      case "installing": return "RESTARTING";
      case "error": return "UPDATE ERROR";
    }
  })();

  const title = (() => {
    switch (flow.kind) {
      case "checking": return "正在检查更新";
      case "upToDate": return "已是最新版本";
      case "available": return `发现新版本 v${flow.newVersion}`;
      case "downloading": return `正在下载 v${flow.newVersion}`;
      case "ready": return "已就绪,重启即可生效";
      case "installing": return "正在重启…";
      case "error": return "更新遇到问题";
    }
  })();

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && dismissible) onClose(); }}>
      <section className="provider-modal update-modal" role="dialog" aria-modal="true" aria-labelledby="update-modal-title">
        <div className="modal-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id="update-modal-title">{title}</h2>
          </div>
          {dismissible && (
            <button className="modal-close" type="button" onClick={onClose} aria-label="关闭">×</button>
          )}
        </div>

        {flow.kind === "checking" && (
          <p className="modal-description"><span className="spinner" style={{ borderTopColor: "var(--accent)" }} /> 正在联系 GitHub Releases,稍候…</p>
        )}

        {flow.kind === "upToDate" && (
          <p className="modal-description">当前 v{APP_VERSION} 已经是最新版本,无需更新。</p>
        )}

        {flow.kind === "available" && (
          <>
            <p className="modal-description">当前版本 <strong>v{flow.currentVersion}</strong>,新版本 <strong>v{flow.newVersion}</strong>。</p>
            {flow.notes && (
              <div className="release-notes">
                <div className="release-notes-label">Release Notes</div>
                <div className="release-notes-body">{flow.notes}</div>
              </div>
            )}
            <div className="form-actions confirm-actions">
              <button className="button button-secondary" type="button" onClick={onClose}>稍后</button>
              <button className="button button-primary" type="button" onClick={onDownload}>
                <Icon name="download" size={14} />
                <span>下载并安装</span>
              </button>
            </div>
          </>
        )}

        {flow.kind === "downloading" && (() => {
          const percent = flow.total && flow.total > 0 ? Math.min(100, Math.round((flow.downloaded / flow.total) * 100)) : 0;
          const sizeLabel = (bytes: number) => {
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
          };
          return (
            <>
              <p className="modal-description">
                下载中… {sizeLabel(flow.downloaded)}
                {flow.total ? ` / ${sizeLabel(flow.total)}` : ""}
              </p>
              <ProgressBar value={percent} tone="success" />
            </>
          );
        })()}

        {flow.kind === "ready" && (
          <>
            <p className="modal-description">v{flow.newVersion} 已下载完成并通过签名校验。点击重启后,应用会自动关闭并启动新版本。</p>
            <div className="form-actions confirm-actions">
              <button className="button button-secondary" type="button" onClick={onClose}>稍后重启</button>
              <button className="button button-primary" type="button" onClick={onRelaunch}>
                <Icon name="restart" size={14} />
                <span>立即重启</span>
              </button>
            </div>
          </>
        )}

        {flow.kind === "installing" && (
          <p className="modal-description"><span className="spinner" style={{ borderTopColor: "var(--accent)" }} /> 正在准备重启…</p>
        )}

        {flow.kind === "error" && (
          <>
            <p className="modal-description form-error">
              <Icon name="alert" size={15} />
              <span>{flow.message}</span>
            </p>
            <div className="form-actions confirm-actions">
              <button className="button button-secondary" type="button" onClick={onClose}>关闭</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ── Overview (Claude Code stats) ─────────────────────────────────────────────

const HEAT_GLYPHS = ["·", "░", "▒", "▓", "█"] as const;

function densityGlyph(density: number, inRange: boolean): string {
  if (!inRange) return "·";
  if (density <= 0) return "·";
  return HEAT_GLYPHS[Math.min(density, HEAT_GLYPHS.length) - 1] ?? "·";
}

function densityTone(density: number, inRange: boolean): string {
  if (!inRange) return "muted";
  if (density <= 0) return "muted";
  if (density >= 4) return "max";
  if (density >= 3) return "high";
  if (density >= 2) return "mid";
  return "low";
}

function formatTokensShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatTokensLong(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} million`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function pickComparison(grandTotal: number): { label: string; multiplier: number } {
  // Approximate token counts for well-known books (round numbers).
  const refs: Array<{ label: string; tokens: number }> = [
    { label: "The Old Man and the Sea", tokens: 30_000 },
    { label: "Of Mice and Men", tokens: 35_000 },
    { label: "The Great Gatsby", tokens: 70_000 },
    { label: "1984", tokens: 90_000 },
    { label: "Pride and Prejudice", tokens: 120_000 },
    { label: "Moby-Dick", tokens: 200_000 },
    { label: "War and Peace", tokens: 560_000 },
    { label: "Lord of the Rings trilogy", tokens: 1_100_000 },
    { label: "the entire Wikipedia", tokens: 20_000_000_000 },
  ];
  let best = refs[0];
  for (const r of refs) {
    if (r.tokens <= grandTotal) best = r;
  }
  return { label: best.label, multiplier: Math.max(1, Math.round(grandTotal / best.tokens)) };
}

function OverviewView({
  stats,
  statsRange,
  onRangeChange,
  onReload,
  loading,
  error,
}: {
  stats: ClaudeStats | null;
  statsRange: ClaudeStatsRange;
  onRangeChange: (r: ClaudeStatsRange) => void;
  onReload: () => void;
  loading: boolean;
  error: string;
}) {
  const { rows, monthLabels, weeks } = stats?.heatmap ?? { rows: [], monthLabels: [], weeks: 0 };

  const headerLine = (() => {
    if (!weeks) return "";
    const line = new Array(weeks).fill("·");
    for (const span of monthLabels) {
      const start = Math.min(span.startCol, line.length - 1);
      // Replace header markers with the month name starting at startCol.
      // Render the month label characters into consecutive positions.
      const chars = span.label.padEnd(Math.max(1, span.endCol - span.startCol + 1), " ").split("");
      for (let i = 0; i < chars.length && start + i < line.length; i++) {
        line[start + i] = chars[i] ?? " ";
      }
    }
    return "    " + line.join("") + "    ";
  })();

  const rowLines = [0, 2, 4].map((rowIdx) => {
    const label = ["Mon ", "Wed ", "Fri "][rowIdx / 2] ?? "    ";
    const cells = rows[rowIdx] ?? [];
    return label + cells.map((c) => densityGlyph(c.density, c.inRange)).join("");
  });

  const comparison = stats ? pickComparison(stats.totals.grand) : null;

  return (
    <section className="overview-view">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CLAUDE CODE · LOCAL STATS</span>
          <h1>用量概览</h1>
          <p>读取 <code>~/.claude/projects/**/*.jsonl</code> 算出来的本地统计。会随 Claude Code 使用自动增长。</p>
        </div>
        <div className="overview-actions">
          <div className="overview-range" role="tablist" aria-label="时间范围">
            {(["all", "7d", "30d"] as const).map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={statsRange === r}
                className={`overview-range-tab${statsRange === r ? " active" : ""}`}
                type="button"
                onClick={() => onRangeChange(r)}
              >
                {r === "all" ? "All time" : r === "7d" ? "Last 7 days" : "Last 30 days"}
              </button>
            ))}
          </div>
          <button className="icon-button" type="button" onClick={onReload} title="重新统计" aria-label="重新统计" disabled={loading}>
            <Icon name="refresh" size={17} />
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {!stats ? (
        <div className="overview-loading">
          <span className="spinner" />
          读取 <code>~/.claude/projects/</code> 中…
        </div>
      ) : stats.totals.grand === 0 ? (
        <div className="no-data-card">
          <Icon name="alert" size={18} />
          <span>在 <code>~/.claude/projects/</code> 没找到 Claude Code 的会话日志。先用 Claude Code 跑一个 session 再回来看看。</span>
        </div>
      ) : (
        <>
          <div className="overview-heatmap">
            <pre className="overview-heatmap-pre" aria-label="按天 token 用量热图">
              <span className="overview-heatmap-row overview-heatmap-months">{headerLine}</span>
              {rowLines.map((line, i) => (
                <span key={i} className="overview-heatmap-row">
                  {Array.from(line).map((ch, j) => {
                    if (j < 4) return <span key={j}>{ch === " " ? " " : ch}</span>;
                    const cell = rows[i * 2]?.[j - 4];
                    if (!cell) return <span key={j}>{ch}</span>;
                    return (
                      <span key={j} className={`heat-cell tone-${densityTone(cell.density, cell.inRange)}`} title={cell.date ? `${cell.date} · ${formatTokensLong(cell.tokens)} tokens` : ""}>
                        {ch}
                      </span>
                    );
                  })}
                </span>
              ))}
            </pre>
            <div className="overview-heatmap-legend">
              <span>Less</span>
              {HEAT_GLYPHS.map((g) => (
                <span key={g} className="heat-cell tone-static">{g}</span>
              ))}
              <span>More</span>
            </div>
          </div>

          <div className="overview-stats-grid">
            <article className="overview-stat">
              <span className="overview-stat-eyebrow">Favorite model</span>
              <strong className="overview-stat-value">{stats.favoriteModel || "—"}</strong>
              <span className="overview-stat-detail">最常用的模型</span>
            </article>
            <article className="overview-stat">
              <span className="overview-stat-eyebrow">Total tokens</span>
              <strong className="overview-stat-value">{formatTokensLong(stats.totals.grand)}</strong>
              <span className="overview-stat-detail">
                input {formatTokensShort(stats.totals.input)} · output {formatTokensShort(stats.totals.output)} · cache {formatTokensShort(stats.totals.cacheCreate + stats.totals.cacheRead)}
              </span>
            </article>
            <article className="overview-stat">
              <span className="overview-stat-eyebrow">Sessions</span>
              <strong className="overview-stat-value">{stats.sessions}</strong>
              <span className="overview-stat-detail">最近 {stats.firstActivity.slice(0, 10)} 起</span>
            </article>
            <article className="overview-stat">
              <span className="overview-stat-eyebrow">Longest session</span>
              <strong className="overview-stat-value">{stats.longestSession.display}</strong>
              <span className="overview-stat-detail">单次最长对话</span>
            </article>
            <article className="overview-stat">
              <span className="overview-stat-eyebrow">Active days</span>
              <strong className="overview-stat-value">{stats.activeDays}</strong>
              <span className="overview-stat-detail">有活动的天数</span>
            </article>
            <article className="overview-stat">
              <span className="overview-stat-eyebrow">Longest streak</span>
              <strong className="overview-stat-value">{stats.longestStreak} days</strong>
              <span className="overview-stat-detail">连续活动最长</span>
            </article>
            <article className="overview-stat">
              <span className="overview-stat-eyebrow">Most active day</span>
              <strong className="overview-stat-value">{stats.mostActiveDay.date || "—"}</strong>
              <span className="overview-stat-detail">{formatTokensShort(stats.mostActiveDay.tokens)} tokens</span>
            </article>
            <article className="overview-stat">
              <span className="overview-stat-eyebrow">Current streak</span>
              <strong className="overview-stat-value">{stats.currentStreak} days</strong>
              <span className="overview-stat-detail">今天还在连续活动?</span>
            </article>
          </div>

          <div className="overview-models">
            <div className="overview-section-eyebrow">模型分布</div>
            {stats.models.map((m) => (
              <div key={m.name} className="overview-model-row">
                <span className="overview-model-name">{m.name}</span>
                <div className="overview-model-bar-track">
                  <div className="overview-model-bar-fill" style={{ width: `${Math.max(2, m.percent)}%` }} />
                </div>
                <span className="overview-model-meta">
                  {m.percent.toFixed(1)}% · {formatTokensShort(m.tokens)}
                </span>
              </div>
            ))}
          </div>

          {comparison && stats.rangeTokens > 0 && (
            <p className="overview-comparison">
              在当前时间范围内你用了 ~<strong>{comparison.multiplier.toLocaleString()}×</strong>{" "}
              <em>{comparison.label}</em> 的 tokens
              <span className="overview-comparison-meta">（{formatTokensLong(stats.rangeTokens)} tokens）</span>
            </p>
          )}
        </>
      )}
    </section>
  );
}

function ProgressBar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="progress-track" aria-label={`${value}% 剩余`}>
      <div className={`progress-value ${tone}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function MetricCard({
  eyebrow,
  value,
  suffix,
  detail,
  icon,
  tone,
}: {
  eyebrow: string;
  value: string;
  suffix?: string;
  detail: string;
  icon: IconName;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-topline">
        <span className="metric-eyebrow">{eyebrow}</span>
        <span className={`metric-icon ${tone}`}><Icon name={icon} size={17} /></span>
      </div>
      <div className="metric-value">{value}{suffix && <span>{suffix}</span>}</div>
      <div className="metric-detail">{detail}</div>
    </article>
  );
}

function ModelUsageCard({ model }: { model: ModelRemain }) {
  const intervalPercent = clampPercent(model.current_interval_remaining_percent);
  const weeklyPercent = clampPercent(model.current_weekly_remaining_percent);
  const status = getStatus(Math.min(intervalPercent, weeklyPercent));

  return (
    <article className="model-card">
      <div className="model-card-header">
        <div className="model-name-wrap">
          <span className={`status-dot ${status.tone}`} />
          <div>
            <h3>{formatModelName(model.model_name)}</h3>
            <p>{model.model_name} · {formatRange(model.start_time, model.end_time)}</p>
          </div>
        </div>
        <span className={`status-badge ${status.tone}`}><span className="status-badge-dot" />{status.label}</span>
      </div>

      <div className="quota-grid">
        <div className="quota-block">
          <div className="quota-heading">
            <span>当前周期</span>
            <strong>{intervalPercent}%</strong>
          </div>
          <ProgressBar value={intervalPercent} tone={status.tone} />
        </div>
        <div className="quota-block">
          <div className="quota-heading">
            <span>本周额度</span>
            <strong>{weeklyPercent}%</strong>
          </div>
          <ProgressBar value={weeklyPercent} tone={getStatus(weeklyPercent).tone} />
        </div>
      </div>

      <div className="model-card-footer">
        <span>周周期 {formatRange(model.weekly_start_time, model.weekly_end_time)}</span>
        <span>下次刷新 {formatDate(model.end_time)}</span>
      </div>
    </article>
  );
}

function App() {
  const [ready, setReady] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [panelMode, setPanelMode] = useState<PanelMode>({ kind: "closed" });
  const [welcomeDraft, setWelcomeDraft] = useState({ provider: "minimax" as ProviderId, connectionName: "", apiKey: "" });
  const [darkMode, setDarkMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [updateFlow, setUpdateFlow] = useState<UpdateFlowState>({ kind: "closed" });
  const [mainView, setMainView] = useState<MainView>("dashboard");
  const [claudeStats, setClaudeStats] = useState<ClaudeStats | null>(null);
  const [claudeStatsRange, setClaudeStatsRange] = useState<ClaudeStatsRange>("all");
  const [claudeStatsLoading, setClaudeStatsLoading] = useState(false);
  const [claudeStatsError, setClaudeStatsError] = useState("");
  const claudeStatsReqId = useRef(0);
  const updateInFlight = useRef(false);
  const storeRef = useRef<LazyStore | null>(null);

  // ── 启动:从磁盘 store 读回上次会话的连接 / 激活项 / 主题 ──────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const store = new LazyStore("settings.json", { autoSave: true });
        await store.init();
        storeRef.current = store;

        const [storedConnections, storedActiveId, storedDark] = await Promise.all([
          store.get<Connection[]>("connections"),
          store.get<string | null>("activeId"),
          store.get<boolean>("darkMode"),
        ]);

        if (cancelled) return;
        if (Array.isArray(storedConnections)) setConnections(storedConnections);
        if (storedActiveId !== undefined && storedActiveId !== null) setActiveId(storedActiveId);
        if (typeof storedDark === "boolean") setDarkMode(storedDark);
        setReady(true);
      } catch (value) {
        // 加载失败(首装 / 文件损坏) → 用空状态启动
        if (cancelled) return;
        setError(`无法读取本地设置:${value instanceof Error ? value.message : String(value)}`);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── 持久化:连接 / 激活项 / 主题变化就写回 store ────────────────────────
  useEffect(() => {
    if (!ready) return;
    storeRef.current?.set("connections", connections).catch(() => {});
  }, [connections, ready]);

  useEffect(() => {
    if (!ready) return;
    storeRef.current?.set("activeId", activeId).catch(() => {});
  }, [activeId, ready]);

  useEffect(() => {
    if (!ready) return;
    storeRef.current?.set("darkMode", darkMode).catch(() => {});
  }, [darkMode, ready]);

  const activeConnection = useMemo(
    () => connections.find((connection) => connection.id === activeId) ?? null,
    [connections, activeId],
  );
  const models = activeConnection?.plan?.model_remains ?? [];

  const summary = useMemo(() => {
    if (models.length === 0) {
      return {
        intervalPercent: 0,
        weeklyPercent: 0,
        modelCount: 0,
        nextReset: 0,
      };
    }

    const resetTimes = models.map((model) => model.end_time).filter((value) => value > 0);

    return {
      intervalPercent: Math.round(Math.min(...models.map((model) => clampPercent(model.current_interval_remaining_percent)))),
      weeklyPercent: Math.round(Math.min(...models.map((model) => clampPercent(model.current_weekly_remaining_percent)))),
      modelCount: models.length,
      nextReset: resetTimes.length > 0 ? Math.min(...resetTimes) : 0,
    };
  }, [models]);

  const createId = () => `conn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const fetchPlan = useCallback(async (provider: ProviderId, key: string): Promise<TokenPlan | null> => {
    try {
      return await invoke<TokenPlan>("fetch_token_plan", {
        provider,
        apiKey: key.trim(),
      });
    } catch (value) {
      throw new Error(normalizeError(value));
    }
  }, []);

  const addConnection = useCallback(
    async (input: { provider: ProviderId; connectionName: string; apiKey: string }): Promise<boolean> => {
      setLoading(true);
      setError("");
      try {
        const plan = await fetchPlan(input.provider, input.apiKey);
        const providerLabel = providerOptions.find((option) => option.id === input.provider)?.label ?? "Coding Plan";
        const trimmedName = input.connectionName.trim();
        const id = createId();
        const newConnection: Connection = {
          id,
          providerId: input.provider,
          name: trimmedName || `${providerLabel} · ${id.slice(-4)}`,
          apiKey: input.apiKey.trim(),
          plan,
          updatedAt: Date.now(),
          error: "",
        };
        setConnections((list) => [...list, newConnection]);
        setActiveId(id);
        return true;
      } catch (value) {
        setError(value instanceof Error ? value.message : normalizeError(value));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fetchPlan],
  );

  const reloadConnection = useCallback(
    async (id: string): Promise<boolean> => {
      const target = connections.find((connection) => connection.id === id);
      if (!target) return false;
      setLoading(true);
      setError("");
      try {
        const plan = await fetchPlan(target.providerId, target.apiKey);
        setConnections((list) =>
          list.map((connection) =>
            connection.id === id
              ? { ...connection, plan, updatedAt: Date.now(), error: "" }
              : connection,
          ),
        );
        return true;
      } catch (value) {
        const message = value instanceof Error ? value.message : normalizeError(value);
        setConnections((list) =>
          list.map((connection) =>
            connection.id === id ? { ...connection, error: message } : connection,
          ),
        );
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [connections, fetchPlan],
  );

  const openAddPanel = () => {
    setError("");
    setPanelMode({ kind: "create", draft: { provider: "minimax", connectionName: "", apiKey: "" } });
  };

  const openAddPanelWithDraft = () => {
    setError("");
    setPanelMode({
      kind: "create",
      draft: {
        provider: welcomeDraft.provider,
        connectionName: welcomeDraft.connectionName,
        apiKey: welcomeDraft.apiKey,
      },
    });
  };

  const openEditPanel = () => {
    if (!activeConnection) {
      openAddPanel();
      return;
    }
    setError(activeConnection.error ?? "");
    setPanelMode({
      kind: "edit",
      id: activeConnection.id,
      draft: {
        provider: activeConnection.providerId,
        connectionName: activeConnection.name,
        apiKey: activeConnection.apiKey,
      },
    });
  };

  const closePanel = () => {
    setPanelMode({ kind: "closed" });
    setError("");
  };

  const handleWelcomeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!welcomeDraft.apiKey.trim()) {
      setError("请输入 API Key");
      return;
    }
    const ok = await addConnection(welcomeDraft);
    if (ok) {
      setWelcomeDraft({ provider: "minimax", connectionName: "", apiKey: "" });
      setError("");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (panelMode.kind === "closed") return;

    const draft = panelMode.draft;
    if (!draft.apiKey.trim()) {
      setError("请输入 API Key");
      return;
    }

    if (panelMode.kind === "edit") {
      const id = panelMode.id;
      setLoading(true);
      setError("");
      try {
        const plan = await fetchPlan(draft.provider, draft.apiKey);
        const trimmedName = draft.connectionName.trim();
        setConnections((list) =>
          list.map((connection) =>
            connection.id === id
              ? {
                  ...connection,
                  providerId: draft.provider,
                  apiKey: draft.apiKey.trim(),
                  name: trimmedName || connection.name,
                  plan,
                  updatedAt: Date.now(),
                  error: "",
                }
              : connection,
          ),
        );
        setActiveId(id);
        setPanelMode({ kind: "closed" });
      } catch (value) {
        const message = value instanceof Error ? value.message : normalizeError(value);
        setError(message);
      } finally {
        setLoading(false);
      }
      return;
    }

    const ok = await addConnection(draft);
    if (ok) {
      setPanelMode({ kind: "closed" });
      setWelcomeDraft({ provider: "minimax", connectionName: "", apiKey: "" });
    }
  };

  const handleRefresh = async () => {
    if (!activeConnection) {
      openAddPanel();
      return;
    }
    await reloadConnection(activeConnection.id);
  };

  const removeConnection = useCallback((id: string) => {
    setConnections((list) => list.filter((connection) => connection.id !== id));
    setActiveId((current) => (current === id ? null : current));
    setPanelMode((mode) => (mode.kind === "edit" && mode.id === id ? { kind: "closed" } : mode));
  }, []);

  const removeActiveConnection = () => {
    if (!activeConnection) return;
    removeConnection(activeConnection.id);
    setPanelMode({ kind: "closed" });
  };

  const requestRemove = (id: string, name: string) => {
    setPendingDelete({ id, name });
  };

  const cancelRemove = () => {
    setPendingDelete(null);
  };

  const confirmRemove = () => {
    if (!pendingDelete) return;
    removeConnection(pendingDelete.id);
    setPendingDelete(null);
  };

  const closeUpdate = () => {
    if (updateFlow.kind === "downloading" || updateFlow.kind === "installing") return;
    setUpdateFlow({ kind: "closed" });
  };

  // ── Claude Code stats: 拉到本地 JSONL 算用量概览 ────────────────────────────
  const loadClaudeStats = useCallback(async (range: ClaudeStatsRange = claudeStatsRange) => {
    const reqId = ++claudeStatsReqId.current;
    setClaudeStatsLoading(true);
    setClaudeStatsError("");
    try {
      const next = await fetchClaudeStats(range);
      if (reqId === claudeStatsReqId.current) {
        setClaudeStats(next);
      }
    } catch (value) {
      const message = value instanceof Error ? value.message : String(value);
      if (reqId === claudeStatsReqId.current) {
        setClaudeStatsError(`无法读取 Claude Code 数据：${message}`);
      }
    } finally {
      if (reqId === claudeStatsReqId.current) {
        setClaudeStatsLoading(false);
      }
    }
  }, [claudeStatsRange]);

  // 切到 overview 时自动拉一次,切换 range 时重拉
  useEffect(() => {
    if (!ready) return;
    if (mainView === "overview" && !claudeStats) {
      void loadClaudeStats(claudeStatsRange);
    }
  }, [ready, mainView, claudeStats, claudeStatsRange, loadClaudeStats]);

  const triggerUpdateCheck = useCallback(async () => {
    if (updateInFlight.current) return;
    updateInFlight.current = true;
    setUpdateFlow({ kind: "checking" });
    try {
      const outcome: UpdateCheckOutcome = await checkForAppUpdate(APP_VERSION);
      if (outcome.kind === "upToDate") {
        setUpdateFlow({ kind: "upToDate" });
      } else if (outcome.kind === "available") {
        const newVersion = outcome.update.version ?? "latest";
        const notes = outcome.update.body ?? null;
        setUpdateFlow({
          kind: "available",
          update: outcome.update,
          currentVersion: APP_VERSION,
          newVersion,
          notes,
        });
      } else {
        setUpdateFlow({ kind: "error", message: outcome.message });
      }
    } finally {
      updateInFlight.current = false;
    }
  }, []);

  const runUpdateDownload = useCallback(async () => {
    const current = updateFlow;
    if (current.kind !== "available") return;
    updateInFlight.current = true;
    setUpdateFlow({
      kind: "downloading",
      update: current.update,
      currentVersion: current.currentVersion,
      newVersion: current.newVersion,
      downloaded: 0,
      total: null,
    });
    try {
      let downloaded = 0;
      await downloadAndInstallUpdate(current.update, (chunk, total) => {
        downloaded += chunk;
        setUpdateFlow((prev) =>
          prev.kind === "downloading"
            ? { ...prev, downloaded, total }
            : prev,
        );
      });
      setUpdateFlow({
        kind: "ready",
        update: current.update,
        currentVersion: current.currentVersion,
        newVersion: current.newVersion,
      });
    } catch (value) {
      const message = value instanceof Error ? value.message : String(value);
      setUpdateFlow({ kind: "error", message: `下载或安装失败：${message}` });
    } finally {
      updateInFlight.current = false;
    }
  }, [updateFlow]);

  const triggerRelaunch = useCallback(async () => {
    setUpdateFlow((prev) => (prev.kind === "ready" ? { kind: "installing" } : prev));
    try {
      await relaunchApp();
    } catch (value) {
      const message = value instanceof Error ? value.message : String(value);
      setUpdateFlow({ kind: "error", message: `重启失败：${message}` });
    }
  }, []);

  const draftProvider = panelMode.kind === "closed" ? "minimax" : panelMode.draft.provider;
  const draftName = panelMode.kind === "closed" ? "" : panelMode.draft.connectionName;
  const draftApiKey = panelMode.kind === "closed" ? "" : panelMode.draft.apiKey;

  const activeProvider = activeConnection
    ? providerOptions.find((option) => option.id === activeConnection.providerId) ?? providerOptions[0]
    : providerOptions[0];

  const showErrorBanner = error && activeConnection && Boolean(activeConnection.plan);
  const showEmptyStateError = error && !activeConnection?.plan;

  const overallStatus = activeConnection && models.length > 0
    ? getStatus(Math.min(summary.intervalPercent, summary.weeklyPercent))
    : { label: "暂无模型", tone: "warning" };

  const dashboardEyebrowName = activeConnection
    ? activeConnection.name
    : "CODING PLAN";

  if (!ready) {
    return (
      <div className={`app-shell splash${darkMode ? " dark" : ""}`}>
        <div className="splash-screen" role="status" aria-live="polite">
          <div className="splash-mark" aria-hidden="true">
            <Icon name="layers" size={28} strokeWidth={1.7} />
          </div>
          <div className="splash-copy">
            <strong>Token Watch</strong>
            <span className="splash-line" />
            <span className="splash-hint">正在加载本地设置…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell${darkMode ? " dark" : ""}`}>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark"><Icon name="layers" size={19} strokeWidth={1.7} /></div>
          <div className="brand-copy">
            <strong>Token Watch</strong>
            <span>coding plan desk</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="主导航">
          <button
            className={`nav-item${mainView === "overview" ? " active" : ""}`}
            type="button"
            onClick={() => setMainView("overview")}
          >
            <Icon name="overview" size={17} />
            <span>用量概览</span>
          </button>
          <button className="nav-item" type="button" onClick={openAddPanelWithDraft}>
            <Icon name="plus" size={17} />
            <span>添加 Provider</span>
          </button>
        </nav>

        <div className="sidebar-section">
          <div className="section-label">已连接 {connections.length > 0 ? `(${connections.length})` : ""}</div>
          {connections.length > 0 ? (
            <div className="connection-list">
              {connections.map((connection) => {
                const providerLabel = providerOptions.find((option) => option.id === connection.providerId)?.label ?? "";
                const connectionModels = connection.plan?.model_remains ?? [];
                const interval = connectionModels.length > 0 ? Math.min(...connectionModels.map((model) => clampPercent(model.current_interval_remaining_percent))) : null;
                const weekly = connectionModels.length > 0 ? Math.min(...connectionModels.map((model) => clampPercent(model.current_weekly_remaining_percent))) : null;
                const isActive = connection.id === activeId;
                return (
<div
                      key={connection.id}
                      className={`provider-item${isActive ? " active" : ""}`}
                      aria-current={isActive ? "true" : undefined}
                    >
                      <button
                        className="provider-item-button"
                        type="button"
                        onClick={() => { setActiveId(connection.id); setMainView("dashboard"); }}
                        title={`切换到 ${connection.name}`}
                      >
                        <span className="provider-symbol" title={providerLabel}>{providerLabel.slice(0, 1).toUpperCase() || "M"}</span>
                        <span className="provider-item-copy">
                          <strong>{connection.name}</strong>
                          <small className="provider-item-metrics">
                            <span>当前 <b>{interval !== null ? `${Math.round(interval)}%` : "—"}</b></span>
                            <span>本周 <b>{weekly !== null ? `${Math.round(weekly)}%` : "—"}</b></span>
                          </small>
                        </span>
                      </button>
                      <div className="provider-item-actions">
                        <button
                          className="provider-item-action provider-item-action-danger"
                          type="button"
                          onClick={(event) => { event.stopPropagation(); requestRemove(connection.id, connection.name); }}
                          title="移除这个 Provider"
                          aria-label={`移除 ${connection.name}`}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </div>
                );
              })}
            </div>
          ) : (
            <div className="sidebar-empty">
              <span className="sidebar-empty-line" />
              <span>还没有 Provider</span>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="privacy-line"><Icon name="lock" size={14} /><span>Key 仅保存在当前会话</span></div>
          <span className="version-label">Token Watch · v{APP_VERSION}</span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-separator">/</span><strong>{activeConnection ? activeConnection.name : "用量概览"}</strong></div>
          <div className="topbar-actions">
            {activeConnection && (
              <span className="last-updated">更新于 {activeConnection.updatedAt ? formatDate(activeConnection.updatedAt) : "刚刚"}</span>
            )}
            <button
              className={`icon-button${loading ? " is-loading" : ""}`}
              type="button"
              onClick={handleRefresh}
              title="刷新用量"
              aria-label="刷新用量"
              disabled={loading}
            >
              <Icon name="refresh" size={17} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => setDarkMode((value) => !value)}
              title={darkMode ? "切换浅色模式" : "切换暗色模式"}
              aria-label={darkMode ? "切换浅色模式" : "切换暗色模式"}
            >
              <Icon name={darkMode ? "sun" : "moon"} size={17} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={triggerUpdateCheck}
              title="检查更新"
              aria-label="检查更新"
              disabled={updateFlow.kind === "checking" || updateFlow.kind === "downloading" || updateFlow.kind === "installing"}
            >
              <Icon name="download" size={16} />
            </button>
            <button className="topbar-provider" type="button" onClick={activeConnection ? openEditPanel : openAddPanelWithDraft}>
              <span className={`status-dot ${activeConnection ? "success" : "muted"}`} />
              <span>{activeConnection ? activeConnection.name : "未连接"}</span>
              <Icon name="chevron" size={14} />
            </button>
          </div>
        </header>

        <main className="content-area">
          {!activeConnection ? (
            <section className="welcome-view">
              <div className="welcome-copy">
                <span className="eyebrow">PERSONAL USAGE DESK</span>
                <h1>把额度留在视线里</h1>
                <p>连接你的 Coding Plan，安静地查看当前周期与每周用量。可以同时添加多条连接，逐个切换查看。</p>
              </div>

              <div className="setup-card">
                <div className="setup-card-header">
                  <div className="setup-icon"><Icon name="key" size={19} /></div>
                  <div>
                    <h2>连接一个 Provider</h2>
                    <p>先从 Minimax 开始，更多 Provider 会逐步加入。</p>
                  </div>
                </div>
                <ProviderForm
                  provider={welcomeDraft.provider}
                  connectionName={welcomeDraft.connectionName}
                  apiKey={welcomeDraft.apiKey}
                  keyVisible={keyVisible}
                  loading={loading}
                  error={error}
                  compact
                  onProviderChange={(value) => setWelcomeDraft((draft) => ({ ...draft, provider: value }))}
                  onConnectionNameChange={(value) => setWelcomeDraft((draft) => ({ ...draft, connectionName: value }))}
                  onApiKeyChange={(value) => setWelcomeDraft((draft) => ({ ...draft, apiKey: value }))}
                  onToggleKey={() => setKeyVisible((value) => !value)}
                  onSubmit={handleWelcomeSubmit}
                />
                <button className="button button-secondary welcome-secondary" type="button" onClick={openAddPanelWithDraft}>
                  在弹窗里继续编辑
                </button>
              </div>

              <div className="security-note"><Icon name="lock" size={15} /><span>你的 API Key 只在本次运行期间保留，并通过本地 Rust 层请求 Minimax。</span></div>
            </section>
          ) : mainView === "overview" ? (
            <OverviewView
              stats={claudeStats}
              statsRange={claudeStatsRange}
              onRangeChange={setClaudeStatsRange}
              onReload={loadClaudeStats}
              loading={claudeStatsLoading}
              error={claudeStatsError}
            />
          ) : (
            <section className="dashboard-view">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">{activeProvider.label.toUpperCase()} · {dashboardEyebrowName}</span>
                  <h1>用量概览</h1>
                  <p>这里是 {activeConnection.name} 的额度状态，按模型查看更细的周期信息。</p>
                </div>
                <div className={`overall-status ${overallStatus.tone}`}><span className="status-badge-dot" />{overallStatus.label}</div>
              </div>

              {showErrorBanner && (
                <div className="error-banner" role="alert"><Icon name="alert" size={16} /><span>{error}</span><button type="button" onClick={() => setError("")}>知道了</button></div>
              )}

              {showEmptyStateError && (
                <div className="error-banner" role="alert"><Icon name="alert" size={16} /><span>{error}</span><button type="button" onClick={openEditPanel}>重新配置</button></div>
              )}

              {activeConnection.plan ? (
                <>
                  <div className="metrics-grid">
                    <MetricCard eyebrow="当前周期剩余" value={String(summary.intervalPercent)} suffix="%" detail="所有模型中最低剩余比例" icon="clock" tone={getStatus(summary.intervalPercent).tone} />
                    <MetricCard eyebrow="本周额度剩余" value={String(summary.weeklyPercent)} suffix="%" detail="按所有模型的保守值计算" icon="layers" tone={getStatus(summary.weeklyPercent).tone} />
                    <MetricCard eyebrow="已接入模型" value={String(summary.modelCount)} detail={models.map((model) => formatModelName(model.model_name)).join("、") || "暂无模型"} icon="overview" tone="accent" />
                    <MetricCard eyebrow="下次刷新" value={summary.nextReset ? formatDate(summary.nextReset).split(" ")[0] : "—"} detail={summary.nextReset ? formatDate(summary.nextReset).split(" ").slice(1).join(" ") : "暂无时间信息"} icon="refresh" tone="neutral" />
                  </div>

                  <div className="section-heading-row">
                    <div>
                      <h2>按模型查看</h2>
                      <p>{models.length} 个模型 · 数据来自 {activeProvider.label} Token Plan</p>
                    </div>
                    <button className="button button-secondary button-refresh" type="button" onClick={handleRefresh} disabled={loading}>
                      <Icon name="refresh" size={15} />
                      {loading ? "读取中" : "刷新数据"}
                    </button>
                  </div>

                  {models.length > 0 ? (
                    <div className="models-list">
                      {models.map((model) => <ModelUsageCard key={`${model.model_name}-${model.start_time}`} model={model} />)}
                    </div>
                  ) : (
                    <div className="no-data-card"><Icon name="alert" size={18} /><span>Provider 返回了空的模型列表。</span></div>
                  )}
                </>
              ) : (
                <div className="no-data-card"><Icon name="alert" size={18} /><span>正在等待首次加载完成…</span></div>
              )}

              <div className="data-footnote"><Icon name="lock" size={14} /><span>数据仅在本地展示，Token Watch 不会上传或持久化你的 API Key。</span><button type="button" onClick={openEditPanel}>管理连接 <Icon name="external" size={13} /></button></div>
            </section>
          )}
        </main>
      </div>

      {pendingDelete && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) cancelRemove(); }}>
          <section className="provider-modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title">
            <div className="modal-header">
              <div>
                <span className="eyebrow">CONFIRM REMOVE</span>
                <h2 id="confirm-delete-title">移除这个 Provider？</h2>
              </div>
              <button className="modal-close" type="button" onClick={cancelRemove} aria-label="关闭">×</button>
            </div>
            <p className="modal-description">
              确定要移除「{pendingDelete.name}」吗？此操作会清掉当前会话里的 API Key 与缓存用量,无法撤销。
            </p>
            <div className="form-actions confirm-actions">
              <button className="button button-secondary" type="button" onClick={cancelRemove}>
                取消
              </button>
              <button className="button button-primary confirm-danger" type="button" onClick={confirmRemove}>
                <Icon name="trash" size={14} />
                <span>确认移除</span>
              </button>
            </div>
          </section>
        </div>
      )}

      <UpdateModal
        flow={updateFlow}
        onClose={closeUpdate}
        onDownload={runUpdateDownload}
        onRelaunch={triggerRelaunch}
      />

      {panelMode.kind !== "closed" && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePanel(); }}>
          <section className="provider-modal" role="dialog" aria-modal="true" aria-labelledby="provider-modal-title">
            <div className="modal-header">
              <div>
                <span className="eyebrow">PROVIDER SETTINGS</span>
                <h2 id="provider-modal-title">{panelMode.kind === "edit" ? "编辑连接" : "添加 Provider"}</h2>
              </div>
              <button className="modal-close" type="button" onClick={closePanel} aria-label="关闭">×</button>
            </div>
            <p className="modal-description">为这个连接起一个名字（可选），输入 API Key。请求会在本地完成。</p>
            <ProviderForm
              provider={draftProvider}
              connectionName={draftName}
              apiKey={draftApiKey}
              keyVisible={keyVisible}
              loading={loading}
              error={error}
              submitLabel={panelMode.kind === "edit" ? "保存并刷新" : "连接并查看"}
              onProviderChange={(value) => setPanelMode((mode) => mode.kind === "closed" ? mode : { ...mode, draft: { ...mode.draft, provider: value } })}
              onConnectionNameChange={(value) => setPanelMode((mode) => mode.kind === "closed" ? mode : { ...mode, draft: { ...mode.draft, connectionName: value } })}
              onApiKeyChange={(value) => setPanelMode((mode) => mode.kind === "closed" ? mode : { ...mode, draft: { ...mode.draft, apiKey: value } })}
              onToggleKey={() => setKeyVisible((value) => !value)}
              onSubmit={handleSubmit}
              onCancel={closePanel}
            />
            {panelMode.kind === "edit" && activeConnection && (
              <div className="disconnect-row">
                <button className="disconnect-button" type="button" onClick={removeActiveConnection}>
                  <Icon name="trash" size={13} />
                  <span>移除当前连接</span>
                </button>
                <span className="disconnect-hint">会清掉该连接的 API Key 与已缓存的用量</span>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
