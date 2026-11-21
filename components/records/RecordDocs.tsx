import type { ReactNode } from "react";
import { ATTEND_LABEL, RESOLUTION, addMonths, fmtDate, fmtNum, fmtTime, num, parseDate, pct } from "@/lib/meeting";
import {
  KIND_LABEL,
  isAssembly,
  judge,
  minutesName,
  recordAttendance,
  recordTitle,
  recordTotals,
  type MeetingRecord,
} from "@/lib/records";

export type RecordDocKey = "minutes" | "roster" | "result" | "followup" | "cover";

export const RECORD_DOCS: { key: RecordDocKey; title: (r: MeetingRecord) => string; desc: string }[] = [
  { key: "minutes", title: (r) => minutesName(r.kind), desc: "성원·보고·안건별 심의 경과와 표결 결과, 의장·서명자 서명란" },
  { key: "roster", title: () => "참석자 명부", desc: "참석 방식(직접·위임·서면)과 서명란, 성원 집계" },
  { key: "result", title: (r) => (isAssembly(r.kind) ? "결과 공고문" : "의결사항 공고문"), desc: "의결 결과 게시용, 결의 취소의 소 기한 안내" },
  { key: "followup", title: () => "의결사항 이행 점검표", desc: "결정 사항별 담당자·기한·완료 여부" },
  { key: "cover", title: () => "회의 서류 보관 표지", desc: "회의록과 함께 철할 첨부 서류 목록·보관 장소" },
];

const B = ({ v, w }: { v?: string; w?: number }) =>
  v ? <>{v}</> : <span className="blank" style={w ? { minWidth: `${w}mm` } : undefined}>&nbsp;</span>;

function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mt-page ${className}`}>{children}</section>;
}

const agendas = (r: MeetingRecord) => r.agendas.filter((a) => a.title.trim());
const voteAgendas = (r: MeetingRecord) => agendas(r).filter((a) => a.mode === "vote");
const when = (r: MeetingRecord) => (r.date ? `${fmtDate(r.date)}${r.openTime ? ` ${fmtTime(r.openTime)}` : ""}` : "");
const memberWord = (r: MeetingRecord) => (isAssembly(r.kind) ? "구분소유자" : r.kind === "committee" ? "위원" : "참석자");

/* ---------- 회의록(의사록) ---------- */
function Minutes({ r }: { r: MeetingRecord }) {
  const asm = isAssembly(r.kind);
  const t = recordTotals(r);
  const at = recordAttendance(r);
  const list = agendas(r);
  const reports = list.filter((a) => a.mode === "report");
  const votes = list.filter((a) => a.mode === "vote");
  const signers = r.signers.filter((s) => s.trim());
  const signRows = signers.length ? signers : ["", ""];
  let n = 1;
  return (
    <Page>
      <h1>{recordTitle(r)} {minutesName(r.kind)}</h1>
      <table className="f">
        <tbody>
          <tr><th>일 시</th><td>{r.date ? fmtDate(r.date) : <B w={40} />} 개회 <B v={r.openTime ? fmtTime(r.openTime) : ""} w={20} /> ~ 폐회 <B v={r.closeTime ? fmtTime(r.closeTime) : ""} w={20} /></td></tr>
          <tr><th>장 소</th><td><B v={r.place} w={60} /></td></tr>
          {(asm || r.convener) && <tr><th>소집권자</th><td><B v={r.convener} w={50} /></td></tr>}
        </tbody>
      </table>

      <h2>{n++}. 성원 보고</h2>
      {asm ? (
        <table className="f grid">
          <thead><tr><th>구분</th><th>전체</th><th>직접 참석</th><th>위임</th><th>서면결의</th><th>합계</th></tr></thead>
          <tbody>
            <tr><td>구분소유자 수</td><td>{t.heads || ""}명</td><td>{at.present.heads}명</td><td>{at.proxy.heads}명</td><td>{at.written.heads}명</td><td>{at.all.heads}명 ({pct(at.all.heads, t.heads)})</td></tr>
            <tr><td>의결권(㎡)</td><td>{t.area ? fmtNum(t.area) : ""}</td><td>{fmtNum(at.present.area)}</td><td>{fmtNum(at.proxy.area)}</td><td>{fmtNum(at.written.area)}</td><td>{fmtNum(at.all.area)} ({pct(at.all.area, t.area)})</td></tr>
          </tbody>
        </table>
      ) : (
        <p>
          {r.kind === "committee" ? "재적 위원" : "대상 인원"} {t.heads || "　"}명 중 {at.all.heads}명 출석
          {at.proxy.heads ? `(대리 ${at.proxy.heads}명 포함)` : ""}
          {r.attendees.some((a) => a.attend && a.name) && (
            <>: {r.attendees.filter((a) => a.attend && a.name).map((a) => `${a.name}${a.role ? `(${a.role})` : ""}`).join(", ")}</>
          )}
        </p>
      )}
      <p>
        의장은 위와 같이 성원을 보고하고 {r.openTime ? fmtTime(r.openTime) : "　　"}에 개회를 선언하였다.
        {r.noticeDate ? ` 소집통지는 ${fmtDate(r.noticeDate, false)} ${r.noticeMethod || ""}${r.noticeMethod ? "(으)로 " : " "}하였음을 보고하였다.` : ""}
      </p>

      {(r.reports.trim() || reports.length > 0) && (
        <>
          <h2>{n++}. 보고 사항</h2>
          {r.reports.trim() && <p className="pre">{r.reports}</p>}
          {reports.map((a, i) => (
            <div key={a.id}>
              <h3>보고 {i + 1}: {a.title}</h3>
              {a.discussion && <p className="pre">{a.discussion}</p>}
              {a.decision && <p className="pre">{a.decision}</p>}
            </div>
          ))}
        </>
      )}

      <h2>{n++}. 안건 심의 및 의결</h2>
      {votes.length === 0 && <p>의결 안건 없음</p>}
      {votes.map((a, i) => {
        const j = judge(r, a);
        const voted = !!(a.yes.heads || a.no.heads || a.abstain.heads);
        const h = (v: string) => v || (voted ? "0" : "　");
        return (
          <div key={a.id}>
            <h3>
              제{i + 1}호 의안: {a.title}
              {asm && <span className="note"> ({RESOLUTION[a.type].text} 찬성 필요)</span>}
            </h3>
            <p className="pre">{a.discussion || "의장은 본 안건을 상정하고 제안 이유와 주요 내용을 설명한 뒤 질의응답을 거쳐 표결에 부쳤다."}</p>
            <table className="f grid">
              <thead>
                <tr><th>구분</th><th>찬성</th><th>반대</th><th>기권</th>{asm && <th>찬성 비율(전체 대비)</th>}</tr>
              </thead>
              <tbody>
                <tr>
                  <td>{memberWord(r)} 수</td>
                  <td>{h(a.yes.heads)}명</td><td>{h(a.no.heads)}명</td><td>{h(a.abstain.heads)}명</td>
                  {asm && <td>{pct(num(a.yes.heads), t.heads)}</td>}
                </tr>
                {asm && (
                  <tr>
                    <td>의결권(㎡)</td>
                    <td>{a.yes.area ? fmtNum(num(a.yes.area)) : ""}</td><td>{a.no.area ? fmtNum(num(a.no.area)) : ""}</td><td>{a.abstain.area ? fmtNum(num(a.abstain.area)) : ""}</td>
                    <td>{pct(num(a.yes.area), t.area)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {a.decision && <p className="pre"><b>의결 내용:</b> {a.decision}</p>}
            <p className="pass">결과: {j.label ? `${j.label}되었음을 선포하였다.`.replace("보류되었음", "보류하기로 하였음") : <B w={40} />}</p>
          </div>
        );
      })}

      {r.other.trim() && (
        <>
          <h2>{n++}. 기타 토의</h2>
          <p className="pre">{r.other}</p>
        </>
      )}

      <p style={{ marginTop: "4mm" }}>
        의장은 회의 목적사항을 모두 마쳤으므로 {r.closeTime ? fmtTime(r.closeTime) : "　　"}에 폐회를 선언하였다. 위 의사의 경과와 결과를 명확히 하기 위하여 이{" "}
        {minutesName(r.kind)}을 작성{asm ? "하고 의장과 출석한 구분소유자 2인이 다음과 같이 서명 또는 날인한다" : "한다"}.
      </p>
      <div className="sign-area" style={{ textAlign: "right" }}>
        <div className="date" style={{ textAlign: "center" }}>{r.date ? fmtDate(r.date, false) : "　　　　년　　월　　일"}</div>
        {/* 관리단집회 의사록은 의장과 출석 구분소유자 2인의 서명·날인이 법정 요건(법 제39조)이라 남겨 둔다 */}
        {asm && (
          <>
            <p>의　　장 <B v={r.chair} w={35} /> <span className="stamp">(서명/인)</span></p>
            {signRows.map((s, i) => (
              <p key={i}>구분소유자 <B v={s} w={35} /> <span className="stamp">(서명/인)</span></p>
            ))}
          </>
        )}
      </div>
    </Page>
  );
}

/* ---------- 참석자 명부 ---------- */
function Roster({ r }: { r: MeetingRecord }) {
  const asm = isAssembly(r.kind);
  const list = r.attendees.filter((a) => a.unit || a.name);
  const t = recordTotals(r);
  const at = recordAttendance(r);
  const rows = list.length ? list : Array.from({ length: asm ? 25 : 12 }, () => null);
  return (
    <Page>
      <h1>참석자 명부</h1>
      <p className="center">{r.associationName} {recordTitle(r)} / {when(r)} / {r.place}</p>
      <table className="f grid">
        <thead>
          <tr>
            <th style={{ width: "9mm" }}>번호</th>
            {asm && <th style={{ width: "18mm" }}>호실</th>}
            <th>{asm ? "구분소유자" : "성명"}</th>
            {asm ? <th style={{ width: "20mm" }}>전유면적(㎡)</th> : <th style={{ width: "26mm" }}>직책</th>}
            <th style={{ width: "22mm" }}>참석 방식</th>
            <th style={{ width: "22mm" }}>대리인</th>
            <th style={{ width: "28mm" }}>서명</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => (
            <tr key={a?.id ?? i} style={{ height: "9mm" }}>
              <td>{i + 1}</td>
              {asm && <td>{a?.unit}</td>}
              <td>{a?.name}</td>
              {asm ? <td className="r">{a?.area}</td> : <td>{a?.role}</td>}
              <td>{a ? ATTEND_LABEL[a.attend] : ""}</td>
              <td>{a?.proxyName}</td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length > 0 && (
        <table className="f grid">
          <thead><tr><th>구분</th><th>전체</th><th>직접 참석</th><th>위임</th><th>서면결의</th><th>합계(성원)</th></tr></thead>
          <tbody>
            <tr><td>{memberWord(r)} 수</td><td>{t.heads}명</td><td>{at.present.heads}명</td><td>{at.proxy.heads}명</td><td>{at.written.heads}명</td><td>{at.all.heads}명 ({pct(at.all.heads, t.heads)})</td></tr>
            {asm && <tr><td>의결권(면적)</td><td>{fmtNum(t.area)}㎡</td><td>{fmtNum(at.present.area)}</td><td>{fmtNum(at.proxy.area)}</td><td>{fmtNum(at.written.area)}</td><td>{fmtNum(at.all.area)}㎡ ({pct(at.all.area, t.area)})</td></tr>}
          </tbody>
        </table>
      )}
    </Page>
  );
}

/* ---------- 결과 공고문 ---------- */
function Result({ r }: { r: MeetingRecord }) {
  const asm = isAssembly(r.kind);
  const t = recordTotals(r);
  const at = recordAttendance(r);
  const d = parseDate(r.date);
  const suit = d ? addMonths(d, 6) : null;
  const list = voteAgendas(r);
  return (
    <Page className="announce">
      <h1>{asm ? "관리단집회 결과 공고" : `${KIND_LABEL[r.kind]} 의결사항 공고`}</h1>
      <p>
        {r.date ? fmtDate(r.date) : "　　"} {r.place}에서 개최한 {r.associationName} {recordTitle(r)}의 의결 결과를 다음과 같이 알려 드립니다.
      </p>
      <p className="note">
        {asm
          ? `성원: 전체 구분소유자 ${t.heads || "　"}명 중 ${at.all.heads}명(${pct(at.all.heads, t.heads)}), 의결권 ${pct(at.all.area, t.area)} 참석 (직접 ${at.present.heads}명 · 위임 ${at.proxy.heads}명 · 서면결의 ${at.written.heads}명)`
          : `출석: ${r.kind === "committee" ? "재적 위원" : "대상"} ${t.heads || "　"}명 중 ${at.all.heads}명`}
      </p>
      <table className="f grid">
        <thead>
          <tr><th style={{ width: "18mm" }}>의안</th><th>안건 및 의결 내용</th>{asm && <th style={{ width: "34mm" }}>찬성(수/의결권)</th>}{!asm && <th style={{ width: "28mm" }}>찬성/반대/기권</th>}<th style={{ width: "20mm" }}>결과</th></tr>
        </thead>
        <tbody>
          {list.map((a, i) => {
            const j = judge(r, a);
            return (
              <tr key={a.id}>
                <td>제{i + 1}호</td>
                <td className="l">
                  {a.title}
                  {a.decision && <div className="note pre">{a.decision}</div>}
                </td>
                {asm ? (
                  <td>{a.yes.heads ? `${pct(num(a.yes.heads), t.heads)} / ${pct(num(a.yes.area), t.area)}` : ""}</td>
                ) : (
                  <td>{a.yes.heads || a.no.heads ? `${a.yes.heads || 0}/${a.no.heads || 0}/${a.abstain.heads || 0}` : ""}</td>
                )}
                <td className="pass">{j.label}</td>
              </tr>
            );
          })}
          {list.length === 0 && <tr><td colSpan={4}>의결 안건 없음</td></tr>}
        </tbody>
      </table>
      {asm && (
      <ol className="note">
        {(
          <li>결의에 이의가 있는 구분소유자는 결의일로부터 6개월 이내{suit ? `(${fmtDate(suit, false)}까지)` : ""} 결의 취소의 소를 제기할 수 있습니다(법 제42조의2).</li>
        )}
      </ol>
      )}
      <div className="sign-area">
        <div className="date"><B v={r.resultDate ? fmtDate(r.resultDate, false) : ""} w={50} /></div>
        <div className="who">{r.associationName}</div>
      </div>
    </Page>
  );
}

/* ---------- 이행 점검표 ---------- */
function FollowUpDoc({ r }: { r: MeetingRecord }) {
  const list = r.followUps.filter((f) => f.task.trim());
  const rows = list.length ? list : Array.from({ length: 10 }, () => null);
  return (
    <Page>
      <h1>의결사항 이행 점검표</h1>
      <p className="center">{r.associationName} {recordTitle(r)} ({r.date ? fmtDate(r.date, false) : "　"})</p>
      <table className="f grid">
        <thead>
          <tr><th style={{ width: "9mm" }}>번호</th><th>이행할 사항</th><th style={{ width: "24mm" }}>담당</th><th style={{ width: "26mm" }}>기한</th><th style={{ width: "16mm" }}>완료</th><th style={{ width: "34mm" }}>비고</th></tr>
        </thead>
        <tbody>
          {rows.map((f, i) => (
            <tr key={f?.id ?? i} style={{ height: "11mm" }}>
              <td>{i + 1}</td>
              <td className="l">{f?.task}</td>
              <td>{f?.owner}</td>
              <td>{f?.due ? fmtDate(f.due, false) : ""}</td>
              <td>{f ? (f.done ? "완료" : "") : ""}</td>
              <td className="l note">{f?.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sign-area" style={{ textAlign: "right" }}>
        <p>점검일　　　　년　　월　　일　　점검자 <B w={30} /> <span className="stamp">(서명/인)</span></p>
      </div>
    </Page>
  );
}

/* ---------- 서류 보관 표지 ---------- */
function Cover({ r }: { r: MeetingRecord }) {
  const list = r.attachments.filter((a) => a.name.trim());
  return (
    <Page>
      <h1>회의 서류 보관 표지</h1>
      <table className="f">
        <tbody>
          <tr><th>회 의 명</th><td>{r.associationName} {recordTitle(r)}</td></tr>
          <tr><th>일시·장소</th><td>{when(r) || <B w={50} />} / {r.place || <B w={40} />}</td></tr>
          <tr><th>안 건</th><td>{agendas(r).map((a, i) => <div key={a.id}>{i + 1}. {a.title}</div>)}</td></tr>
          <tr><th>보관 장소</th><td><B v={r.storage} w={50} /></td></tr>
          <tr><th>보존 기간</th><td>{isAssembly(r.kind) ? "영구 보존 권장(관리인 보관 의무, 법 제39조)" : "관리규약에서 정한 기간(정함이 없으면 영구 보존 권장)"}</td></tr>
        </tbody>
      </table>
      <h3>철한 서류 목록</h3>
      <table className="f grid">
        <thead><tr><th style={{ width: "9mm" }}>번호</th><th>서류명</th><th style={{ width: "16mm" }}>부수</th><th style={{ width: "16mm" }}>확인</th><th style={{ width: "40mm" }}>비고</th></tr></thead>
        <tbody>
          <tr style={{ height: "9mm" }}><td>1</td><td className="l">{minutesName(r.kind)}(원본, 서명·날인)</td><td>1</td><td></td><td></td></tr>
          {list.map((a, i) => (
            <tr key={a.id} style={{ height: "9mm" }}>
              <td>{i + 2}</td><td className="l">{a.name}</td><td>{a.copies}</td><td>{a.have ? "✓" : ""}</td><td className="l note">{a.note}</td>
            </tr>
          ))}
          {Array.from({ length: 3 }, (_, i) => (
            <tr key={`e${i}`} style={{ height: "9mm" }}><td>{list.length + 2 + i}</td><td></td><td></td><td></td><td></td></tr>
          ))}
        </tbody>
      </table>
      <p className="note">※ 이해관계인이 {minutesName(r.kind)} 열람·등본 교부를 청구하면 정당한 이유 없이 거부할 수 없습니다. 열람·교부 일자와 청구인을 기록해 두십시오.</p>
      <table className="f grid">
        <thead><tr><th style={{ width: "26mm" }}>일자</th><th>청구인(호실·성명)</th><th style={{ width: "28mm" }}>열람/등본</th><th style={{ width: "28mm" }}>처리자 확인</th></tr></thead>
        <tbody>
          {Array.from({ length: 5 }, (_, i) => (
            <tr key={i} style={{ height: "9mm" }}><td></td><td></td><td></td><td></td></tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}

export function RecordDocView({ r, docKey }: { r: MeetingRecord; docKey: RecordDocKey }) {
  switch (docKey) {
    case "minutes":
      return <Minutes r={r} />;
    case "roster":
      return <Roster r={r} />;
    case "result":
      return <Result r={r} />;
    case "followup":
      return <FollowUpDoc r={r} />;
    case "cover":
      return <Cover r={r} />;
  }
}
