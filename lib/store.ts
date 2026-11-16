"use client";

// 서버(Redis) 저장 + 브라우저 저장(예비용). 서버에 못 붙으면 브라우저에만 저장한다.

export type SyncStatus = "loading" | "saving" | "server" | "local" | "auth" | "error";

export const STATUS_TEXT: Record<SyncStatus, string> = {
  loading: "불러오는 중…",
  saving: "서버에 저장 중…",
  server: "서버에 저장됨",
  local: "서버 저장소 미연결 · 이 브라우저에만 저장됨",
  auth: "접속코드가 필요합니다 · 이 브라우저에만 저장됨",
  error: "서버 저장 실패 · 이 브라우저에만 저장됨",
};

const LOCAL_PREFIX = "26center:";

export function getAccessCode() {
  try {
    return localStorage.getItem("26center:accessCode") ?? "";
  } catch {
    return "";
  }
}
export function setAccessCode(code: string) {
  try {
    localStorage.setItem("26center:accessCode", code);
  } catch {}
}

export function readLocal<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(LOCAL_PREFIX + key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value));
  } catch {}
}

function statusOf(res: Response): SyncStatus {
  if (res.status === 401) return "auth";
  if (res.status === 503) return "local";
  return res.ok ? "server" : "error";
}

/** 서버 값을 우선 읽고, 없으면 브라우저 값을 돌려준다. */
export async function loadData<T>(key: string): Promise<{ value: T | null; status: SyncStatus; fromServer: boolean }> {
  const local = readLocal<T>(key);
  try {
    const res = await fetch(`/api/data?key=${encodeURIComponent(key)}`, {
      headers: { "x-access-code": getAccessCode() },
      cache: "no-store",
    });
    const status = statusOf(res);
    if (status !== "server") return { value: local, status, fromServer: false };
    const { value } = (await res.json()) as { value: T | null };
    if (value != null) {
      writeLocal(key, value);
      return { value, status, fromServer: true };
    }
    return { value: local, status, fromServer: false };
  } catch {
    return { value: local, status: "error", fromServer: false };
  }
}

/** 브라우저에 바로 저장하고 서버에도 저장한다. */
export async function saveData(key: string, value: unknown): Promise<SyncStatus> {
  writeLocal(key, value);
  try {
    const res = await fetch("/api/data", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-access-code": getAccessCode() },
      body: JSON.stringify({ key, value }),
    });
    return statusOf(res);
  } catch {
    return "error";
  }
}
