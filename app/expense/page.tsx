"use client";

import { useEffect, useMemo, useState } from "react";
import { fmt, parseAmount } from "@/lib/bills";

type Row = { date: string; vendor: string; desc: string; amount: string; note: string; category: string };
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

const CAT_KEY = "26center:categories";

const emptyRow = (): Row => ({ date: "", vendor: "", desc: "", amount: "", note: "", category: "" });

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
    if (!v) return null;
    const sh = JSON.parse(v) as Sheet;
    return { ...sh, rows: sh.rows.map((r) => ({ ...emptyRow(), ...r })) };
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
  const [cats, setCats] = useState<string[]>(CATEGORIES);
  const [showCats, setShowCats] = useState(false);
  const [newCat, setNewCat] = useState("");

  useEffect(() => {
    try {
      const v = localStorage.getItem(CAT_KEY);
      if (v) setCats(JSON.parse(v) as string[]);
    } catch {}
  }, []);
  const saveCats = (next: string[]) => {
    setCats(next);
    try {
      localStorage.setItem(CAT_KEY, JSON.stringify(next));
    } catch {}
  };
  const addCat = () => {
    const c = newCat.trim();
    if (!c) return;
    if (!cats.includes(c)) saveCats([...cats, c]);
    setNewCat("");
  };

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
    if (!sheet) return { sum: 0, byCat: [] as [string, number, number][] };
    const map = new Map<string, number>();
    const cnt = new Map<string, number>();
    let sum = 0;
    for (const r of sheet.rows) {
      const n = parseAmount(r.amount);
      if (n == null) continue;
      sum += n;
      const c = r.category.trim() || "(미분류)";
      map.set(c, (map.get(c) ?? 0) + n);
      cnt.set(c, (cnt.get(c) ?? 0) + 1);
    }
    const order = (c: string) => (cats.indexOf(c) === -1 ? 999 : cats.indexOf(c));
    const byCat = [...map.entries()]
      .sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0], "ko"))
      .map(([c, n]) => [c, n, cnt.get(c) ?? 0] as [string, number, number]);
    return { sum, byCat };
  }, [sheet, cats]);

  if (!sheet) return null;
  const [y, m] = ym.split("-").map(Number);
  const title = `${y}년 ${m}월`;

  const update = (patch: Partial<Sheet>) => setSheet({ ...sheet, ...patch });
  const updateRow = (i: number, patch: Partial<Row>) => {
    const rows = sheet.rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    if (i === rows.length - 1) rows.push(emptyRow());
    update({ rows });
  };

  const insertRowAfter = (i: number) => {
    const rows = [...sheet.rows];
    rows.splice(i + 1, 0, emptyRow());
    update({ rows });
  };

  function copyPrev() {
    const prev = load(prevMonth(ym));
    if (!prev) {
      alert("지난달 경비내역서가 이 브라우저에 없습니다.");
      return;
    }
    if (!confirm("지난달 항목(내용·비고·부과항목)을 가져옵니다. 금액은 비워둡니다. 계속할까요?")) return;
    const rows = prev.rows.filter((r) => r.desc || r.category).map((r) => ({ ...r, amount: "", date: "" }));
    update({ rows: [...rows, ...Array.from({ length: 5 }, emptyRow)] });
  }

  function downloadCsv() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [
      [`${title} 경비내역서 [${sheet!.periodStart}~${sheet!.periodEnd}]`],
      ["일자", "사용처", "내용", "총금액", "비고", "관리비부과항목"],
      ["", "", "전일(전월) 이월금액", String(parseAmount(sheet!.carryOver) ?? ""), "", ""],
      ...sheet!.rows
        .filter((r) => r.desc || r.amount || r.vendor)
        .map((r) => [r.date, r.vendor, r.desc, String(parseAmount(r.amount) ?? ""), r.note, r.category]),
      ["", "", "합계", String(totals.sum), "", ""],
      [],
      ["관리비부과항목", "건수", "금액"],
      ...totals.byCat.map(([c, n, k]) => [c, String(k), String(n)]),
      ["합계", "", String(totals.sum)],
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
        <button
          className="ghost"
          onClick={() => {
            const filled = sheet.rows.filter((r) => r.desc || r.amount || r.vendor || r.date);
            const empty = sheet.rows.filter((r) => !(r.desc || r.amount || r.vendor || r.date));
            filled.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
            update({ rows: [...filled, ...empty] });
          }}
        >
          일자순 정렬
        </button>
        <button className="ghost" onClick={() => setShowCats(!showCats)}>
          부과항목 관리
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

      {showCats && (
        <section className="card no-print cat-panel">
          <h2>관리비부과항목 목록</h2>
          <div className="chips">
            {cats.map((c, i) => (
              <span className="chip" key={c}>
                <button
                  className="ghost small"
                  title="앞으로"
                  disabled={i === 0}
                  onClick={() => {
                    const n = [...cats];
                    [n[i - 1], n[i]] = [n[i], n[i - 1]];
                    saveCats(n);
                  }}
                >
                  ‹
                </button>
                {c}
                <button
                  className="ghost small danger"
                  title="목록에서 삭제"
                  onClick={() => confirm(`'${c}' 항목을 목록에서 삭제할까요? (이미 입력한 행은 그대로 둡니다)`) && saveCats(cats.filter((x) => x !== c))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="row">
            <input
              value={newCat}
              placeholder="새 항목 이름"
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCat()}
            />
            <button onClick={addCat}>추가</button>
            <button className="ghost" onClick={() => confirm("기본 항목 목록으로 되돌릴까요?") && saveCats(CATEGORIES)}>
              기본값으로
            </button>
            <span className="muted small">목록은 모든 달에 공통으로 쓰입니다. ‹ 로 순서를 바꾸면 합계표 순서도 바뀝니다.</span>
          </div>
        </section>
      )}

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
              <th className="date">일 자</th>
              <th>사용처</th>
              <th>내 용</th>
              <th className="amt">총금액</th>
              <th>비 고</th>
              <th className="cat">관리비부과항목</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            <tr className="carry">
              <td></td>
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
              <tr key={i} className={!r.desc && !r.amount && !r.vendor ? "empty" : ""}>
                <td>
                  <input
                    type="date"
                    className={r.date ? "" : "blank"}
                    min={`${prevMonth(ym)}-01`}
                    max={`${ym}-${String(lastDay(ym)).padStart(2, "0")}`}
                    value={r.date}
                    onChange={(e) => updateRow(i, { date: e.target.value })}
                  />
                </td>
                <td>
                  <input value={r.vendor} onChange={(e) => updateRow(i, { vendor: e.target.value })} />
                </td>
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
                  <select value={r.category} onChange={(e) => updateRow(i, { category: e.target.value })}>
                    <option value=""></option>
                    {cats.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    {r.category && !cats.includes(r.category) && <option value={r.category}>{r.category}</option>}
                  </select>
                </td>
                <td className="no-print row-actions">
                  <button className="ghost small" title="아래에 빈 행 추가" onClick={() => insertRowAfter(i)}>
                    +
                  </button>
                  <button
                    className="ghost small danger"
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
              <td colSpan={2}></td>
              <th>합 계</th>
              <th className="right">{fmt(totals.sum)}</th>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>

        <h2 className="sub">관리비부과항목별 합계</h2>
        <table className="table expense summary">
          <thead>
            <tr>
              <th>관리비부과항목</th>
              <th className="cnt">건수</th>
              <th className="amt">금액</th>
            </tr>
          </thead>
          <tbody>
            {totals.byCat.length === 0 && (
              <tr>
                <td colSpan={3} className="muted pad">
                  금액과 관리비부과항목을 입력하면 항목별로 합산됩니다.
                </td>
              </tr>
            )}
            {totals.byCat.map(([c, n, k]) => (
              <tr key={c}>
                <td className="pad">{c}</td>
                <td className="pad right">{k}</td>
                <td className="pad right">{fmt(n)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>합 계</th>
              <th className="right">{totals.byCat.reduce((x, [, , k]) => x + k, 0)}</th>
              <th className="right">{fmt(totals.sum)}</th>
            </tr>
          </tfoot>
        </table>
      </section>
      <p className="muted small no-print">
        입력 내용은 이 컴퓨터의 브라우저에 자동 저장됩니다. 다른 컴퓨터에서 보려면 CSV로 저장해 옮겨주세요.
      </p>
    </>
  );
}
