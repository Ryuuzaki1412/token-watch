import { useCallback, useMemo, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
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
  | "trash";

type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
};

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
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [panelMode, setPanelMode] = useState<PanelMode>({ kind: "closed" });
  const [welcomeDraft, setWelcomeDraft] = useState({ provider: "minimax" as ProviderId, connectionName: "", apiKey: "" });
  const [darkMode, setDarkMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

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
          <button className={`nav-item${activeConnection ? "" : " active"}`} type="button" onClick={activeConnection ? undefined : openAddPanelWithDraft}>
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
                        onClick={() => setActiveId(connection.id)}
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
          <span className="version-label">Token Watch · 0.1</span>
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
