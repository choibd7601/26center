"use client";

import { useEffect, useMemo, useState } from "react";
import { fmt, parseAmount } from "@/lib/bills";

type Row = { desc: string; amount: string; note: string; category: string };
type Sheet = { periodStart: string; periodEnd: string; carryOver: string; rows: Row[] };

const CATEGORIES = [
  "지급수수료",
  "전기요금",
  "한전전기요금",
  "수도요금",
  "소모품비",
  "직원급여",
  "직원보험료",
  "복리후생비",
  "감가상각비",
];

const emptyRow = (): Row => ({ desc: "", amount: "", note: "", category: "" });

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function lastDay(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function newSheet(ym: string): Sheet {
  const [, m] = ym.split("-").map(Number);
  return {
    periodStart: `${m}/1`,
    periodEnd: `${m}/${lastDay(ym)}`,
    carryOver: "",
    rows: Array.from({ length: 20 }, emptyRow),
  };
}
const storeKey = (ym: string) => `26center:expense:${ym}`;
function load(ym: string): Sheet | null {
  try {
    const v = localStorage.getItem(storeKey(ym));
    return v ? (JSON.parse(v) as Sheet) : null;
  } catch {
    return null;
  }
}
function prevMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return monthKey(new Date(y, m - 2, 1));
}

export default function ExpensePage() {
  const [ym, setYm] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    const k = monthKey();
    setYm(k);
  }, []);

  useEffect(() => {
    if (!ym) return;
    setSheet(load(ym) ?? newSheet(ym));
  }, [ym]);

  useEffect(() => {
    if (!sheet || !ym) return;
    try {
      localStorage.setItem(storeKey(ym), JSON.stringify(sheet));
      setSavedMsg("자동 저장됨");
    } catch {
      setSavedMsg("저장 실패 (브라우저 저장소를 쓸 수 없음)");
    }
  }, [sheet, ym]);

  const totals = useMemo(() => {
    if (!sheet) return { sum: 0, byCat: [] as [string, number][] };
    const map = new Map<string, number>();
    let sum = 0;
    for (const r of sheet.rows) {
      const n = parseAmount(r.amount);
      if (n == null) continue;
      sum += n;
      const c = r.category.trim() || "(미분류)";
      map.set(c, (map.get(c) ?? 0) + n);
    }
    return { sum, byCat: [...map.entries()].sort((a, b) => b[1] - a[1]) };
  }, [sheet]);

  if (!sheet) return null;
  const [y, m] = ym.split("-").map(Number);
  const title = `${y}년 ${m}월`;

  const update = (patch: Partial<Sheet>) => setSheet({ ...sheet, ...patch });
  const updateRow = (i: number, patch: Partial<Row>) => {
    const rows = sheet.rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    if (i === rows.length - 1) rows.push(emptyRow());
    update({ rows });
  };

  function copyPrev() {
    const prev = load(prevMonth(ym));
    if (!prev) {
      alert("지난달 경비내역서가 이 브라우저에 없습니다.");
      return;
    }
    if (!confirm("지난달 항목(내용·비고·부과항목)을 가져옵니다. 금액은 비워둡니다. 계속할까요?")) return;
    const rows = prev.rows.filter((r) => r.desc || r.category).map((r) => ({ ...r, amount: "" }));
    update({ rows: [...rows, ...Array.from({ length: 5 }, emptyRow)] });
  }

  function downloadCsv() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [
      [`${title} 경비내역서 [${sheet!.periodStart}~${sheet!.periodEnd}]`],
      ["내용", "총금액", "비고", "관리비부과항목"],
      ["전일(전월) 이월금액", String(parseAmount(sheet!.carryOver) ?? ""), "", ""],
      ...sheet!.rows
        .filter((r) => r.desc || r.amount)
        .map((r) => [r.desc, String(parseAmount(r.amount) ?? ""), r.note, r.category]),
      ["합계", String(totals.sum), "", ""],
      [],
      ["관리비부과항목별 합계"],
      ...totals.byCat.map(([c, n]) => [c, String(n)]),
    ];
    const csv = "﻿" + lines.map((l) => l.map(esc).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `경비내역서_${ym}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="row no-print toolbar">
        <label>월 선택</label>
        <input type="month" value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} />
        <button className="ghost" onClick={copyPrev}>
          지난달 항목 가져오기
        </button>
        <button className="ghost" onClick={() => update({ rows: [...sheet.rows, ...Array.from({ length: 5 }, emptyRow)] })}>
          행 5개 추가
        </button>
        <button onClick={downloadCsv}>엑셀(CSV) 저장</button>
        <button onClick={() => window.print()}>인쇄</button>
        <button
          className="ghost danger"
          onClick={() => confirm(`${title} 내역을 모두 지울까요?`) && setSheet(newSheet(ym))}
        >
          초기화
        </button>
        <span className="muted small">{savedMsg}</span>
      </div>

      <section className="sheet">
        <div className="sheet-head">
          <div className="sheet-title">
            <h1>{title} 경비내역서</h1>
            <div className="period">
              [
              <input value={sheet.periodStart} onChange={(e) => update({ periodStart: e.target.value })} />~
              <input value={sheet.periodEnd} onChange={(e) => update({ periodEnd: e.target.value })} />]
            </div>
          </div>
          <table className="sign">
            <tbody>
              <tr>
                <th>감사</th>
                <th>회장</th>
              </tr>
              <tr>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <table className="table expense">
          <thead>
            <tr>
              <th className="no">No</th>
              <th>내 용</th>
              <th className="amt">총금액</th>
              <th>비 고</th>
              <th>관리비부과항목</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            <tr className="carry">
              <td></td>
              <td className="center">전일(전월) 이월금액</td>
              <td>
                <input
                  className="num"
                  value={sheet.carryOver}
                  onChange={(e) => update({ carryOver: e.target.value })}
                  onBlur={(e) => {
                    const n = parseAmount(e.target.value);
                    update({ carryOver: n == null ? "" : fmt(n) });
                  }}
                />
              </td>
              <td></td>
              <td></td>
              <td className="no-print"></td>
            </tr>
            {sheet.rows.map((r, i) => (
              <tr key={i} className={!r.desc && !r.amount ? "empty" : ""}>
                <td className="no muted">{i + 1}</td>
                <td>
                  <input value={r.desc} onChange={(e) => updateRow(i, { desc: e.target.value })} />
                </td>
                <td>
                  <input
                    className="num"
                    inputMode="numeric"
                    value={r.amount}
                    onChange={(e) => updateRow(i, { amount: e.target.value })}
                    onBlur={(e) => {
                      const n = parseAmount(e.target.value);
                      updateRow(i, { amount: n == null ? "" : fmt(n) });
                    }}
                  />
                </td>
                <td>
                  <input value={r.note} onChange={(e) => updateRow(i, { note: e.target.value })} />
                </td>
                <td>
                  <input
                    list="categories"
                    value={r.category}
                    onChange={(e) => updateRow(i, { category: e.target.value })}
                  />
                </td>
                <td className="no-print">
                  <button
                    className="ghost small"
                    title="행 삭제"
                    onClick={() => update({ rows: sheet.rows.filter((_, j) => j !== i) })}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td></td>
              <th>합 계</th>
              <th className="right">{fmt(totals.sum)}</th>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
        <datalist id="categories">
          {CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <h2 className="sub">관리비부과항목별 합계</h2>
        <table className="table summary">
          <thead>
            <tr>
              <th>관리비부과항목</th>
              <th className="amt">금액</th>
            </tr>
          </thead>
          <tbody>
            {totals.byCat.length === 0 && (
              <tr>
                <td colSpan={2} className="muted">
                  금액을 입력하면 항목별로 합산됩니다.
                </td>
              </tr>
            )}
            {totals.byCat.map(([c, n]) => (
              <tr key={c}>
                <td>{c}</td>
                <td className="right">{fmt(n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="muted small no-print">
        입력 내용은 이 컴퓨터의 브라우저에 자동 저장됩니다. 다른 컴퓨터에서 보려면 CSV로 저장해 옮겨주세요.
      </p>
    </>
  );
}
