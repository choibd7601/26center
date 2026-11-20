"use client";

import { STATUS_TEXT, type SyncStatus } from "@/lib/store";

export default function SyncBadge({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  const cls = status === "server" ? "ok" : status === "loading" || status === "saving" ? "" : status === "conflict" ? "warn" : "bad";
  return (
    <span className={`sync ${cls}`}>
      {STATUS_TEXT[status]}
      {(status === "error" || status === "conflict" || status === "nostore") && (
        <button className="ghost small" onClick={onRetry}>
          {status === "conflict" ? "새로 불러오기" : "다시 시도"}
        </button>
      )}
    </span>
  );
}
