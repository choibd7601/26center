"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BILL_FIELDS, fmt, parseAmount, type BillKind, type ReadResult } from "@/lib/bills";

type Props = {
  kind: BillKind;
  renderResult: (values: Record<string, number | null>) => React.ReactNode;
  historyRow: (values: Record<string, number | null>) => Record<string, string>;
};

type HistoryItem = { month: string; savedAt: string; values: Record<string, number | null>; row: Record<string, string> };

const COLORS = ["#e11d48", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

function loadStore<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveStore(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

async function prepareFile(file: File) {
  if (file.type === "application/pdf") {
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { mediaType: "application/pdf" as const, data: btoa(bin), previewUrl: null, width: 0, height: 0 };
  }
  // 이미지: 긴 변 2400px 로 줄여 JPEG 로 변환 (전송 용량 제한 대비)
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return { mediaType: "image/jpeg" as const, data: dataUrl.split(",")[1], previewUrl: dataUrl, width: w, height: h };
}

export default function BillReader({ kind, renderResult, historyRow }: Props) {
  const fields = BILL_FIELDS[kind];
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [read, setRead] = useState<ReadResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [month, setMonth] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const histKey = `26center:history:${kind}`;

  useEffect(() => {
    setAccessCode(loadStore("26center:accessCode", ""));
    setHistory(loadStore<HistoryItem[]>(histKey, []));
    const d = new Date();
    setMonth(`${d.getFullYear()}년 ${d.getMonth() + 1}월`);
  }, [histKey]);

  const values = useMemo(() => {
    const v: Record<string, number | null> = {};
    for (const f of fields) v[f.key] = parseAmount(inputs[f.key] ?? "");
    return v;
  }, [inputs, fields]);

  async function onFile(file: File) {
    setError("");
    setRead(null);
    setFileName(file.name);
    setBusy(true);
    try {
      const prepared = await prepareFile(file);
      setPreview(prepared.previewUrl);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "content-type": "application/json", "x-access-code": accessCode },
        body: JSON.stringify({ kind, ...prepared, previewUrl: undefined }),
      });
      const json = await res.json();
      if (res.status === 401) {
        setNeedCode(true);
        throw new Error(json.error);
      }
      if (!res.ok) throw new Error(json.error || "판독 실패");
      const r = json as ReadResult;
      setRead(r);
      if (r.billingMonth) setMonth(r.billingMonth);
      const next: Record<string, string> = {};
      for (const f of r.fields) next[f.key] = f.value == null ? "" : fmt(f.value, f.value % 1 ? 1 : 0);
      setInputs(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function saveHistory() {
    const item: HistoryItem = { month, savedAt: new Date().toISOString(), values, row: historyRow(values) };
    const next = [item, ...history.filter((h) => h.month !== month)].slice(0, 36);
    setHistory(next);
    saveStore(histKey, next);
  }

  const historyCols = history[0] ? Object.keys(history[0].row) : [];

  return (
    <div className="stack">
      <section className="card no-print">
        <h2>1. 고지서 스캔 올리기</h2>
        <div
          className="drop"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) onFile(f);
          }}
        >
          {busy ? "판독 중입니다… (10~30초)" : fileName ? `${fileName} — 다른 파일을 올리려면 클릭` : "여기를 클릭하거나 스캔 파일(JPG, PNG, PDF)을 끌어다 놓으세요"}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        {needCode && (
          <div className="row">
            <label>접속코드</label>
            <input
              value={accessCode}
              onChange={(e) => {
                setAccessCode(e.target.value);
                saveStore("26center:accessCode", e.target.value);
              }}
              placeholder="관리자에게 받은 접속코드"
            />
            <span className="muted">입력 후 파일을 다시 올려주세요.</span>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        {read?.warnings?.length ? (
          <ul className="warn">
            {read.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="grid2">
        <section className="card">
          <h2>2. 판독값 확인 · 수정</h2>
          <div className="row">
            <label>청구월</label>
            <input value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>항목</th>
                <th>금액/수치</th>
                <th>고지서 원문</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => {
                const r = read?.fields.find((x) => x.key === f.key);
                return (
                  <tr
                    key={f.key}
                    className={active === f.key ? "active" : ""}
                    onMouseEnter={() => setActive(f.key)}
                    onMouseLeave={() => setActive(null)}
                  >
                    <td>
                      <span className="dot" style={{ background: COLORS[i] }} />
                      {f.label}
                    </td>
                    <td>
                      <input
                        className="num"
                        inputMode="decimal"
                        value={inputs[f.key] ?? ""}
                        onChange={(e) => setInputs({ ...inputs, [f.key]: e.target.value })}
                        onBlur={(e) => {
                          const n = parseAmount(e.target.value);
                          if (n != null) setInputs({ ...inputs, [f.key]: fmt(n, n % 1 ? 1 : 0) });
                        }}
                        placeholder="0"
                      />{" "}
                      <span className="muted">{f.unit}</span>
                    </td>
                    <td className="muted small">
                      {r ? (
                        <>
                          {r.text || "-"}
                          {r.box ? "" : " (위치 없음)"}
                          {r.note && <div>{r.note}</div>}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">스캔 없이 직접 입력해도 계산됩니다. 값을 고치면 아래 계산이 바로 바뀝니다.</p>
        </section>

        <section className="card">
          <h2>고지서 위치</h2>
          {preview ? (
            <div className="preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="고지서" />
              {read?.fields.map((r) => {
                if (!r.box) return null;
                const i = fields.findIndex((f) => f.key === r.key);
                const [x0, y0, x1, y1] = r.box;
                return (
                  <div
                    key={r.key}
                    className={`box ${active === r.key ? "on" : ""}`}
                    style={{
                      left: `${x0 * 100}%`,
                      top: `${y0 * 100}%`,
                      width: `${(x1 - x0) * 100}%`,
                      height: `${(y1 - y0) * 100}%`,
                      borderColor: COLORS[i],
                    }}
                    onMouseEnter={() => setActive(r.key)}
                    onMouseLeave={() => setActive(null)}
                  >
                    <span style={{ background: COLORS[i] }}>{fields[i]?.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">이미지를 올리면 각 금액을 읽은 위치를 색깔 상자로 표시합니다. (PDF는 값만 읽습니다)</p>
          )}
        </section>
      </div>

      <section className="card result">
        <h2>3. 계산 결과 — {month}</h2>
        {renderResult(values)}
        <div className="row no-print">
          <button onClick={saveHistory}>이 달 결과 저장</button>
          <button className="ghost" onClick={() => window.print()}>
            인쇄
          </button>
        </div>
      </section>

      {history.length > 0 && (
        <section className="card">
          <h2>저장된 기록 (이 브라우저)</h2>
          <table className="table">
            <thead>
              <tr>
                <th>청구월</th>
                {historyCols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
                <th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.month}>
                  <td>{h.month}</td>
                  {historyCols.map((c) => (
                    <td key={c} className="right">
                      {h.row[c]}
                    </td>
                  ))}
                  <td className="no-print">
                    <button
                      className="ghost small"
                      onClick={() => {
                        const next = history.filter((x) => x.month !== h.month);
                        setHistory(next);
                        saveStore(histKey, next);
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
