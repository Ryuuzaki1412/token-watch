import { check, type Update, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";

export type UpdateCheckOutcome =
  | { kind: "available"; update: Update }
  | { kind: "upToDate"; currentVersion: string }
  | { kind: "error"; message: string };

export async function checkForAppUpdate(currentVersion: string): Promise<UpdateCheckOutcome> {
  try {
    const update = await check();
    if (!update) {
      return { kind: "upToDate", currentVersion };
    }
    return { kind: "available", update };
  } catch (value) {
    const message = value instanceof Error ? value.message : String(value);
    return { kind: "error", message: `检查更新失败：${message}` };
  }
}

export async function downloadAndInstallUpdate(
  update: Update,
  onProgress?: (downloaded: number, total: number | null) => void,
): Promise<void> {
  let total: number | null = null;
  await update.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? null;
    } else if (event.event === "Progress") {
      onProgress?.(event.data.chunkLength, total);
    }
  });
}

export async function relaunchApp(): Promise<void> {
  await relaunch();
}

// ── Claude Code stats ────────────────────────────────────────────────────────

export type ClaudeStatsRange = "today" | "7d" | "30d";
export type HeatmapMode = "daily" | "cumulative";
export type TokenTotalsMode = "real" | "billable";

export type ClaudeStats = {
  totals: {
    input: number;
    output: number;
    cacheCreate: number;
    cacheRead: number;
    /** All tokens including cache reads — the "真实消耗" headline number. */
    grand: number;
    /** input + output + cache_create — matches Claude Code's `/status`. */
    billable: number;
  };
  sessions: number;
  /** Count of assistant messages with non-zero usage (real API requests). */
  messagesCount: number;
  activeDays: number;
  firstActivity: string;
  lastActivity: string;
  longestSession: { ms: number; display: string };
  longestStreak: number;
  currentStreak: number;
  mostActiveDay: { date: string; tokens: number };
  favoriteModel: string;
  models: Array<{ name: string; tokens: number; percent: number }>;
  range: string;
  rangeTokens: number;
  heatmap: {
    weeks: number;
    rows: HeatCell[][];
    monthLabels: Array<{ startCol: number; endCol: number; label: string }>;
  };
};

export type HeatCell = {
  date: string | null;
  tokens: number;
  density: 0 | 1 | 2 | 3 | 4 | 5;
  inRange: boolean;
};

export async function fetchClaudeStats(range: ClaudeStatsRange = "today"): Promise<ClaudeStats> {
  return invoke<ClaudeStats>("fetch_claude_stats", { range });
}