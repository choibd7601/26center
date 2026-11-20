"use client";

// 이 사이트에서 받은 엑셀(CSV) 파일이나, 그걸 엑셀에서 열어 다시 저장한 .xlsx 를 경비내역서로 읽는다.

export type ImportRow = { date: string; vendor: string; desc: string; amount: string; note: string; category: string };
export type Imported = {
  ym: string | null; // "2026-11"
  periodStart: string | null;
  periodEnd: string | null;
  carryOver: string;
  rows: ImportRow[];
  fileTotal: number | null; // 파일에 적힌 합계 (검증용)
};

const num = (v: unknown): number | null => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[^\d.-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const fmt = (n: number | null) => (n == null ? "" : n.toLocaleString("ko-KR"));
const pad = (n: number) => String(n).padStart(2, "0");

function toDate(v: unknown, ym: string | null): string {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-./\s]+(\d{1,2})[-./\s]+(\d{1,2})/); // 2026-11-05, 2026.11.5
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // 11/5/26 (엑셀 미국식)
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(+m[1])}-${pad(+m[2])}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})$/); // 11/5
  if (m && ym) return `${ym.slice(0, 4)}-${pad(+m[1])}-${pad(+m[2])}`;
  return s;
}

export async function importSheetFile(file: File): Promise<Imported> {
  const XLSX = await import("xlsx");
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  const wb = isCsv
    ? XLSX.read(new TextDecoder("utf-8").decode(await file.arrayBuffer()).replace(/^﻿/, ""), {
        type: "string",
        raw: true, // CSV 글자를 그대로 (날짜·숫자 자동 변환 안 함)
      })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });
  const serialToDate = (n: number) => {
    const d = XLSX.SSF.parse_date_code(n);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : "";
  };
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
  const cell = (r: unknown[], i: number) => (i >= 0 ? r[i] : "");
  const text = (v: unknown) => String(v ?? "").trim();

  // 제목에서 달·기간 찾기: "2026년 11월 경비내역서 [11/1~11/30]"
  let ym: string | null = null;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  for (const r of grid.slice(0, 5)) {
    const line = r.map(text).join(" ");
    const m = line.match(/(\d{4})\s*년\s*(\d{1,2})\s*월/);
    if (m && !ym) ym = `${m[1]}-${pad(+m[2])}`;
    const p = line.match(/\[\s*([^~\]]+?)\s*~\s*([^\]]+?)\s*\]/);
    if (p) [periodStart, periodEnd] = [p[1], p[2]];
  }

  // 머리글 줄 찾기
  const hi = grid.findIndex((r) => {
    const t = r.map((x) => text(x).replace(/\s/g, ""));
    return t.includes("내용") && t.includes("총금액");
  });
  if (hi < 0) throw new Error("'내용', '총금액' 머리글이 있는 줄을 찾지 못했습니다. 이 사이트에서 받은 경비내역서 파일인지 확인해 주세요.");
  const head = grid[hi].map((x) => text(x).replace(/\s/g, ""));
  const col = (name: string) => head.indexOf(name);
  const c = {
    date: col("일자"),
    vendor: col("사용처"),
    desc: col("내용"),
    amount: col("총금액"),
    note: col("비고"),
    category: col("관리비부과항목"),
  };

  let carryOver = "";
  let fileTotal: number | null = null;
  const rows: ImportRow[] = [];
  for (const r of grid.slice(hi + 1)) {
    const desc = text(cell(r, c.desc));
    const compact = desc.replace(/\s/g, "");
    if (compact === "합계") {
      fileTotal = num(cell(r, c.amount));
      break;
    }
    if (compact.includes("이월금액")) {
      carryOver = fmt(num(cell(r, c.amount)));
      continue;
    }
    const row: ImportRow = {
      date: typeof cell(r, c.date) === "number" ? serialToDate(cell(r, c.date) as number) : toDate(cell(r, c.date), ym),
      vendor: text(cell(r, c.vendor)),
      desc,
      amount: fmt(num(cell(r, c.amount))),
      note: text(cell(r, c.note)),
      category: text(cell(r, c.category)),
    };
    if (row.desc || row.amount || row.vendor || row.date) rows.push(row);
  }
  return { ym, periodStart, periodEnd, carryOver, rows, fileTotal };
}
