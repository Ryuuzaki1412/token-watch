import { check, type Update, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

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
