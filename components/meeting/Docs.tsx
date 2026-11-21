import type { ReactNode } from "react";
import {
  ATTEND_LABEL,
  KIND_LABEL,
  RESOLUTION,
  agendaNo,
  attendance,
  cancelSuitDeadline,
  convenerText,
  fmtDate,
  fmtNum,
  fmtTime,
  meetingTitle,
  num,
  passes,
  pct,
  tally,
  totals,
  type Meeting,
  type Owner,
} from "@/lib/meeting";
import type { DocKey } from "./guide";

/** 문서 서식. 화면·인쇄·Word 저장에 같이 쓴다. */
export const DOC_CSS = `
.mt-page { background:#fff; color:#111; width:210mm; max-width:100%; min-height:297mm; margin:0 auto 16px; padding:20mm 18mm; box-shadow:0 1px 4px rgba(0,0,0,.15); font-family:"Batang","바탕","Nanum Myeongjo","Noto Serif KR",serif; font-size:11pt; line-height:1.7; }
.mt-page h1 { text-align:center; font-size:20pt; letter-spacing:2px; margin:0 0 6mm; }
.mt-page h2 { font-size:13pt; margin:6mm 0 2mm; }
.mt-page h3 { font-size:11.5pt; margin:4mm 0 1mm; }
.mt-page p { margin:0 0 2mm; }
.mt-page .to { font-size:12pt; margin-bottom:5mm; }
.mt-page table.f { width:100%; border-collapse:collapse; margin:2mm 0 4mm; }
.mt-page table.f th, .mt-page table.f td { border:1px solid #333; padding:1.5mm 2.5mm; vertical-align:top; text-align:left; }
.mt-page table.f th { background:#eee; width:28mm; font-weight:700; white-space:nowrap; }
.mt-page table.f.grid th { width:auto; text-align:center; }
.mt-page table.f.grid td { text-align:center; vertical-align:middle; }
.mt-page table.f td.l { text-align:left; }
.mt-page table.f td.r { text-align:right; }
.mt-page .sign-area { margin-top:10mm; text-align:center; }
.mt-page .sign-area .date { font-size:12pt; margin-bottom:6mm; }
.mt-page .sign-area .who { font-size:13pt; font-weight:700; }
.mt-page .right { text-align:right; }
.mt-page .center { text-align:center; }
.mt-page .box { border:1px solid #333; padding:3mm 4mm; margin:3mm 0; }
.mt-page .note { font-size:10pt; }
.mt-page .pre { white-space:pre-wrap; }
.mt-page .blank { display:inline-block; min-width:30mm; border-bottom:1px solid #555; color:#999; }
.mt-page .stamp { display:inline-block; white-space:nowrap; padding-left:2mm; color:#888; }
.mt-page ol, .mt-page ul { margin:1mm 0 2mm; padding-left:6mm; }
.mt-page .big { font-size:13pt; }
.mt-page .pass { font-weight:700; }
.mt-page .cut { border-top:1px dashed #777; margin:8mm 0 4mm; padding-top:2mm; font-size:9pt; color:#666; text-align:center; }
.mt-page.announce h1 { font-size:28pt; margin-bottom:10mm; }
.mt-page.announce { font-size:13pt; }
.mt-page.convene .sign-area .who { font-size:28pt; }
.mt-page.rc-page { display:flex; flex-direction:column; }
.mt-page.rc-page > .rc-body { flex:1 0 auto; }
.mt-page.rc-page > .rc-org { margin-top:auto; padding-top:10mm; text-align:center; font-size:20pt; font-weight:700; letter-spacing:2px; }
.mt-page.announce.rc-page > .rc-org { font-size:28pt; }
.mt-page .indent { padding-left:2.2em; }
@page mtdoc { size:A4; margin:0; }
@media print {
  .mt-page { page:mtdoc; box-shadow:none; margin:0; width:auto; min-height:0; padding:15mm 16mm; page-break-after:always; break-after:page; }
  .mt-page:last-child { page-break-after:auto; break-after:auto; }
  .mt-page.rc-page { min-height:296mm; }
}
`;

const B = ({ v, w }: { v?: string; w?: number }) =>
  v ? <>{v}</> : <span className="blank" style={w ? { minWidth: `${w}mm` } : undefined}>&nbsp;</span>;

/** 밑줄 없는 입력란 */
const V = ({ v }: { v?: string; w?: number }) => <>{v || "\u00a0"}</>;

const when = (m: Meeting) =>
  m.date ? `${fmtDate(m.date)} ${fmtTime(m.time)}` : "";

const kindLaw = (m: Meeting) => (m.kind === "regular" ? "제32조" : "제33조");

/** 문서 틀. org를 주면 페이지 맨 아래 가운데에 관리단 명칭을 제목 크기로 넣는다(회의관리 문서와 같은 방식). */
function Page({ children, className = "", org }: { children: ReactNode; className?: string; org?: string }) {
  if (!org) return <section className={`mt-page ${className}`}>{children}</section>;
  return (
    <section className={`mt-page rc-page ${className}`}>
      <div className="rc-body">{children}</div>
      <div className="rc-org">{org}</div>
    </section>
  );
}

const orgName = (m: Meeting) => m.associationName || "26센터 관리단";

function AgendaList({ m, withType = true }: { m: Meeting; withType?: boolean }) {
  const list = m.agendas.filter((a) => a.title.trim());
  if (!list.length) return <B w={80} />;
  return (
    <ol style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
      {list.map((a, i) => (
        <li key={a.id}>
          {agendaNo(i)}: {a.title}
          {withType && <span className="note"> ({RESOLUTION[a.type].text} 찬성)</span>}
        </li>
      ))}
    </ol>
  );
}

const agendas = (m: Meeting) => m.agendas.filter((a) => a.title.trim());

function ownerLabel(o?: Owner) {
  if (!o) return null;
  return `${o.unit ? `${o.unit}호 ` : ""}${o.name}`;
}

/* ---------- 1. 소집통지서 ---------- */
function Notice({ m, owner }: { m: Meeting; owner?: Owner }) {
  const hasRules = agendas(m).some((a) => a.type === "rules");
  const basis =
    m.convener === "request"
      ? `구분소유자 ${m.convenerCount || "  "}인의 소집 청구(${m.requestDate ? fmtDate(m.requestDate, false) : "청구일"})에 따라`
      : m.convener === "noManager"
        ? `관리인이 없어 구분소유자 ${m.convenerCount || "  "}인(5분의 1 이상)의 동의로`
        : m.convener === "court"
          ? `법원의 소집허가${m.courtPermit ? `(${m.courtPermit})` : ""}에 따라`
          : "";
  return (
    <Page org={orgName(m)}>
      <h1>{m.year ? `${m.year}년도 ` : ""}{m.kind === "regular" ? "정기" : "임시"} 총회 소집통지서</h1>
      <p className="to">
        수신: {owner ? <>{ownerLabel(owner)} 구분소유자 귀하</> : <>{m.buildingName} 구분소유자 귀하</>}
      </p>
      <p>
        「집합건물의 소유 및 관리에 관한 법률」 {kindLaw(m)}·제34조 및 {m.associationName} 관리규약에 따라 {basis ? `${basis} ` : ""}
        아래와 같이 {m.year ? `${m.year}년도 ` : ""}{m.kind === "regular" ? "정기" : "임시"} 총회를 소집하오니 참석하여 주시기 바랍니다.
      </p>
      <table className="f">
        <tbody>
          <tr><th>일 시</th><td><B v={when(m)} w={70} /></td></tr>
          <tr><th>장 소</th><td><B v={m.place} w={70} /></td></tr>
          <tr><th>소집권자</th><td><B v={convenerText(m)} /></td></tr>
          <tr><th>회의 안건</th><td><AgendaList m={m} withType={false} /></td></tr>
          <tr>
            <th>서면결의서</th>
            <td>
              제출기한: <B v={m.submitDeadline ? fmtDate(m.submitDeadline) : ""} w={40} /> 까지 / 제출처: <B v={m.submitPlace} w={30} />
              <div className="note">우편 및 방문 제출</div>
            </td>
          </tr>
          <tr><th>문 의</th><td><B v={m.contact || m.managerPhone} w={50} /></td></tr>
        </tbody>
      </table>
      <h3>안내 사항</h3>
      <ol className="note">
        <li>참석하지 못하시는 경우 동봉한 위임장으로 대리인을 선임하여 주십시오.</li>
        <li>위임장에는 위임인의 신분증 사본과 인감증명서 1부를 대리인은 본인 신분증을 지참해 주십시오.</li>
        <li>한 호실을 여러 분이 공유하시는 경우 의결권을 행사할 대표자 1인을 정하여 공유자 대표자 지정서를 제출해 주십시오.</li>
        <li>위에 적은 회의 안건 외의 사항은 결의하지 않습니다.</li>
        <li>점유자(세입자)께서도 이해관계가 있는 안건에 대하여 집회에 출석하여 의견을 진술하실 수 있습니다.</li>
      </ol>
      <p className="note">
        붙임: 1. 의안 설명서 1부{hasRules ? "(관리규약 개정안 등 의안의 요령 포함)" : ""}  2. 위임장 1부  3. 서면결의서 1부  4. 공유자 대표자 지정서 1부(해당 시).
      </p>
      <div className="sign-area">
        <div className="date"><B v={m.noticeDate ? fmtDate(m.noticeDate, false) : ""} w={50} /></div>
      </div>
    </Page>
  );
}

/* ---------- 2. 소집 공고문 ---------- */
function Announce({ m }: { m: Meeting }) {
  return (
    <Page className="announce convene" org={orgName(m)}>
      <h1>{KIND_LABEL[m.kind]} 소집 공고</h1>
      <p className="big center" style={{ marginBottom: "8mm" }}>
        {m.year ? `${m.year}년도 ` : ""}{m.kind === "regular" ? "정기" : "임시"} 총회를 아래와 같이 개최하오니 소유주 여러분의 많은 참석 바랍니다.
      </p>
      <table className="f">
        <tbody>
          <tr><th>일 시</th><td><B v={when(m)} w={70} /></td></tr>
          <tr><th>장 소</th><td><B v={m.place} w={70} /></td></tr>
          <tr><th>소집권자</th><td>{convenerText(m)}</td></tr>
          <tr><th>안 건</th><td><AgendaList m={m} withType={false} /></td></tr>
          <tr><th>참석 대상</th><td>{m.buildingName} 구분소유자</td></tr>
          <tr>
            <th>불참 시</th>
            <td>
              위임장은 <B v={m.submitDeadline ? fmtDate(m.submitDeadline) : ""} w={40} />까지 <B v={m.submitPlace} w={30} />에 제출
            </td>
          </tr>
          <tr><th>문 의</th><td><B v={m.contact || m.managerPhone} w={50} /></td></tr>
        </tbody>
      </table>
      <div className="note">
        <p>
          ※ 위임장은 <B v={m.submitDeadline ? `${fmtDate(m.submitDeadline, false)}${m.submitTime ? ` ${fmtTime(m.submitTime)}` : ""}` : ""} w={45} />까지{" "}
          {m.submitPlace || "관리사무소"}로 제출하여 주십시오.
        </p>
        <p style={{ marginBottom: 0 }}>※ 위임장 및 인감증명서는 공고일 이후 발행한 문서에 한함.</p>
        <p className="indent">
          <B v={m.submitDeadline ? fmtDate(m.submitDeadline) : ""} w={40} /> 도착분에 한하여 의결권을 인정함.
        </p>
        <p>
          ※ 게시 기간: <B v={m.noticeDate ? fmtDate(m.noticeDate, false) : ""} w={35} /> ~{" "}
          <B v={m.postEnd || m.date ? fmtDate(m.postEnd || m.date, false) : ""} w={35} />
        </p>
      </div>
      <div className="sign-area">
        <div className="date"><B v={m.noticeDate ? fmtDate(m.noticeDate, false) : ""} w={50} /></div>
      </div>
    </Page>
  );
}

/* ---------- 3. 의안 설명서 ---------- */
function Explain({ m }: { m: Meeting }) {
  const list = agendas(m);
  return (
    <Page org={orgName(m)}>
      <h1>{meetingTitle(m)} 의안 설명서</h1>
      <p className="right note">집회 일시: {when(m) || "　"} / 장소: {m.place || "　"}</p>
      {list.length === 0 && <p>안건을 입력하세요.</p>}
      {list.map((a, i) => (
        <div key={a.id}>
          <h2>{agendaNo(i)}: {a.title}</h2>
          <table className="f">
            <tbody>
              <tr><th>결의 요건</th><td>{RESOLUTION[a.type].text} 찬성</td></tr>
              <tr><th>제안 이유</th><td className="pre">{a.reason || <B w={80} />}</td></tr>
              <tr>
                <th>{a.type === "rules" ? "의안의 요령\n(개정 내용)" : "주요 내용"}</th>
                <td className="pre">{a.content || <B w={80} />}</td>
              </tr>
              {a.attachments && <tr><th>첨부 자료</th><td className="pre">{a.attachments}</td></tr>}
            </tbody>
          </table>
        </div>
      ))}
    </Page>
  );
}

/* ---------- 4. 위임장 ---------- */
function Proxy({ m, owner }: { m: Meeting; owner?: Owner }) {
  const list = agendas(m);
  return (
    <Page>
      <h1>위 임 장</h1>
      <h3>위임인(구분소유자)</h3>
      <table className="f">
        <tbody>
          <tr><th>호 실</th><td><V v={owner?.unit ? `${owner.unit}호` : ""} w={40} /></td><th>성 명</th><td><V v={owner?.name} w={40} /></td></tr>
          <tr><th>전유면적</th><td><V v={owner?.area ? `${owner.area}㎡` : ""} w={30} /></td><th>연락처</th><td><V v={owner?.phone} w={40} /></td></tr>
          <tr><th>주 소</th><td colSpan={3}><V v={owner?.address} w={100} /></td></tr>
        </tbody>
      </table>
      <h3>수임인(대리인)</h3>
      <table className="f">
        <tbody>
          <tr><th>성 명</th><td><V v={owner?.proxyName} w={40} /></td><th>생년월일</th><td><V /></td></tr>
          <tr><th>연락처</th><td><V /></td><th>위임인과 관계</th><td><V /></td></tr>
        </tbody>
      </table>
      <p>
        본인은 {when(m) || "　　　　"}에 {m.place || "　　　　"}에서 개최되는 {m.associationName} {meetingTitle(m)}에 참석하여
        아래 안건에 관한 의결권을 행사하는 일체의 권한을 위 수임인에게 위임합니다.
      </p>
      {list.length > 0 && (
        <table className="f grid">
          <thead>
            <tr><th style={{ width: "20mm" }}>의안</th><th>안건명</th></tr>
          </thead>
          <tbody>
            {list.map((a, i) => (
              <tr key={a.id}><td>제{i + 1}호</td><td className="l">{a.title}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="sign-area">
        <div className="date">　　　　년　　월　　일</div>
        <div>위임인 <B v={owner?.name} w={40} /> <span className="stamp">(인감날인)</span></div>
      </div>
      <p style={{ marginTop: "8mm" }}><b>{m.associationName} 귀중</b></p>
      <div className="box note">
        <div>첨부: 위임인 신분증 사본과 인감증명서 1부</div>
        <div style={{ paddingLeft: "3em" }}>수임인 신분증(집회 당일 지참).</div>
        <div>제출: {m.submitDeadline ? `${fmtDate(m.submitDeadline)}까지 ` : "　　　　까지 "}{m.submitPlace || "관리사무소"}</div>
        <div>
          인감증명서는 공고일 이후 발행한 문서에 한함, {m.submitDeadline ? fmtDate(m.submitDeadline) : "제출기한"} 도착분에 한하여 의결권을 인정함.
        </div>
      </div>
    </Page>
  );
}

/* ---------- 5. 서면결의서 ---------- */
function Written({ m, owner }: { m: Meeting; owner?: Owner }) {
  const list = agendas(m);
  return (
    <Page org={orgName(m)}>
      <h1>서 면 결 의 서</h1>
      <p className="center">{m.associationName} {meetingTitle(m)} ({when(m) || "일시"})</p>
      <table className="f">
        <tbody>
          <tr><th>호 실</th><td><B v={owner?.unit ? `${owner.unit}호` : ""} w={40} /></td><th>구분소유자</th><td><B v={owner?.name} w={40} /></td></tr>
          <tr><th>전유면적</th><td><B v={owner?.area ? `${owner.area}㎡` : ""} w={30} /></td><th>연락처</th><td><B v={owner?.phone} w={40} /></td></tr>
        </tbody>
      </table>
      <p>본인은 위 관리단집회에 참석하지 못하므로 아래 안건에 대하여 다음과 같이 의결권을 행사합니다.</p>
      <table className="f grid">
        <thead>
          <tr><th style={{ width: "20mm" }}>의안</th><th>안건명</th></tr>
        </thead>
        <tbody>
          {(list.length ? list : [null, null, null]).map((a, i) => (
            <tr key={a?.id ?? i}>
              <td>제{i + 1}호</td>
              <td className="l">{a?.title ?? "\u00a0"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ol className="note">
        <li>제출기한: {m.submitDeadline ? fmtDate(m.submitDeadline) : "　　　　"}까지 / 제출처: {m.submitPlace || "　　　　"} (우편·방문)</li>
        <li>본인 확인을 위해 신분증 사본(또는 인감증명서)을 함께 제출해 주십시오. 공유 호실은 지정된 대표자가 작성합니다.</li>
        <li>서면결의서를 제출한 뒤 집회에 직접 출석하시면 현장 의결이 우선합니다.</li>
      </ol>
      <div className="sign-area">
        <div className="date">　　　　년　　월　　일</div>
        <div>구분소유자 <B v={owner?.name} w={40} /> <span className="stamp">(서명 또는 인)</span></div>
      </div>
    </Page>
  );
}

/* ---------- 6. 소집 청구서·동의서 ---------- */
function Request({ m }: { m: Meeting }) {
  const consent = m.convener === "noManager";
  const t = totals(m);
  const need = t.heads ? Math.ceil(t.heads / 5) : 0;
  return (
    <Page org={orgName(m)}>
      <h1>{consent ? "관리단집회 소집 동의서" : "관리단집회 소집 청구서"}</h1>
      {!consent && (
        <p className="to">
          수신: {m.associationName} 관리인 <B v={m.managerName} w={30} /> 귀하
        </p>
      )}
      <p>
        {consent
          ? `${m.buildingName}에 관리인이 없으므로, 아래 구분소유자들은 「집합건물의 소유 및 관리에 관한 법률」 제33조 제4항에 따라 다음과 같이 ${meetingTitle(m)}를 소집하는 데 동의합니다.`
          : `아래 구분소유자들은 「집합건물의 소유 및 관리에 관한 법률」 제33조 제2항에 따라 회의의 목적사항을 밝혀 ${meetingTitle(m)}의 소집을 청구합니다. 청구일로부터 1주일 이내에 소집통지 절차를 밟아 주시기 바랍니다.`}
      </p>
      <table className="f">
        <tbody>
          <tr><th>회의 목적사항</th><td><AgendaList m={m} /></td></tr>
          <tr><th>희망 일시·장소</th><td>{when(m) || "　"} {m.place}</td></tr>
          <tr><th>대표자</th><td><B v={m.convenerRep} w={40} /> (연락처: <B v={m.contact} w={40} />)</td></tr>
          {need > 0 && <tr><th>요건</th><td className="note">전체 구분소유자 {t.heads}명의 5분의 1 이상 = {need}명 이상 (규약으로 달리 정한 경우 그에 따름)</td></tr>}
        </tbody>
      </table>
      <table className="f grid">
        <thead>
          <tr><th style={{ width: "10mm" }}>번호</th><th style={{ width: "22mm" }}>호실</th><th>성명</th><th>연락처</th><th style={{ width: "32mm" }}>서명 또는 날인</th></tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(10, need) }, (_, i) => (
            <tr key={i} style={{ height: "10mm" }}>
              <td>{i + 1}</td><td></td><td></td><td></td><td></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">※ 각 {consent ? "동의자" : "청구인"}의 신분증 사본 또는 인감증명서를 첨부합니다. 공유 호실은 지정 대표자가 서명합니다.</p>
      <div className="sign-area">
        <div className="date"><B v={m.requestDate ? fmtDate(m.requestDate, false) : ""} w={50} /></div>
      </div>
    </Page>
  );
}

/* ---------- 7. 공유자 대표자 지정서 ---------- */
function Rep({ m, owner }: { m: Meeting; owner?: Owner }) {
  const co = owner ? [owner.name, ...owner.coOwners.split(/[,·/]/).map((s) => s.trim()).filter(Boolean)] : [];
  return (
    <Page org={orgName(m)}>
      <h1>공유자 대표자 지정서</h1>
      <p>
        아래 전유부분의 공유자들은 「집합건물의 소유 및 관리에 관한 법률」 제37조 제2항에 따라 {m.associationName}의 관리단집회에서 의결권을 행사할 자(통지를 받을 자)로
        아래 대표자 1인을 지정합니다.
      </p>
      <table className="f">
        <tbody>
          <tr><th>건 물</th><td>{m.buildingName} {m.buildingAddress}</td></tr>
          <tr><th>호 실</th><td><B v={owner?.unit ? `${owner.unit}호` : ""} w={30} /> (전유면적 <B v={owner?.area} w={20} />㎡)</td></tr>
          <tr><th>지정 대표자</th><td>성명 <B w={35} /> 연락처 <B w={40} /></td></tr>
          <tr><th>적용 범위</th><td>{meetingTitle(m)} 및 이후 관리단집회 일체 (변경 시 서면으로 다시 통지)</td></tr>
        </tbody>
      </table>
      <h3>공유자 명단</h3>
      <table className="f grid">
        <thead><tr><th style={{ width: "10mm" }}>번호</th><th>성명</th><th style={{ width: "25mm" }}>지분</th><th>연락처</th><th style={{ width: "32mm" }}>서명 또는 날인</th></tr></thead>
        <tbody>
          {Array.from({ length: Math.max(4, co.length) }, (_, i) => (
            <tr key={i} style={{ height: "11mm" }}><td>{i + 1}</td><td>{co[i] ?? ""}</td><td></td><td></td><td></td></tr>
          ))}
        </tbody>
      </table>
      <p className="note">※ 공유자 전원의 신분증 사본을 첨부합니다. 지정서가 없으면 통지는 공유자 중 1인에게 할 수 있으나, 의결권 행사에 다툼이 생길 수 있습니다.</p>
      <div className="sign-area"><div className="date">　　　　년　　월　　일</div></div>
    </Page>
  );
}

/* ---------- 8. 참석자 명부 ---------- */
function Roster({ m }: { m: Meeting }) {
  const list = m.owners.filter((o) => o.unit || o.name);
  const t = totals(m);
  const at = attendance(m);
  return (
    <Page>
      <h1>참석자 명부</h1>
      <p className="center">{m.associationName} {meetingTitle(m)} / {when(m)} / {m.place}</p>
      <table className="f grid">
        <thead>
          <tr><th style={{ width: "9mm" }}>번호</th><th style={{ width: "18mm" }}>호실</th><th>구분소유자</th><th style={{ width: "20mm" }}>전유면적(㎡)</th><th style={{ width: "22mm" }}>참석 방식</th><th style={{ width: "22mm" }}>대리인</th><th style={{ width: "28mm" }}>서명</th></tr>
        </thead>
        <tbody>
          {(list.length ? list : Array.from({ length: 25 }, () => null)).map((o, i) => (
            <tr key={o?.id ?? i} style={{ height: "9mm" }}>
              <td>{i + 1}</td>
              <td>{o?.unit}</td>
              <td>{o?.name}</td>
              <td className="r">{o?.area}</td>
              <td>{o ? (o.attend ? ATTEND_LABEL[o.attend] : "") : ""}</td>
              <td>{o?.proxyName}</td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length > 0 && (
        <table className="f grid">
          <thead><tr><th>구분</th><th>전체</th><th>직접 참석</th><th>위임</th><th>서면결의</th><th>합계(성원)</th></tr></thead>
          <tbody>
            <tr><td>구분소유자 수</td><td>{t.heads}명</td><td>{at.present.heads}명</td><td>{at.proxy.heads}명</td><td>{at.written.heads}명</td><td>{at.all.heads}명 ({pct(at.all.heads, t.heads)})</td></tr>
            <tr><td>의결권(면적)</td><td>{fmtNum(t.area)}㎡</td><td>{fmtNum(at.present.area)}</td><td>{fmtNum(at.proxy.area)}</td><td>{fmtNum(at.written.area)}</td><td>{fmtNum(at.all.area)}㎡ ({pct(at.all.area, t.area)})</td></tr>
          </tbody>
        </table>
      )}
    </Page>
  );
}

/* ---------- 9. 의사록 ---------- */
function resultOf(m: Meeting, id: string, type: Meeting["agendas"][number]["type"]) {
  const t = totals(m);
  const y = tally(m, id);
  const voted = y.yes.heads + y.no.heads + y.abstain.heads;
  if (!voted) return { y, voted, label: "", ok: false };
  const p = passes(y.yes.heads, y.yes.area, t, type);
  return { y, voted, label: p.ok ? "가결" : "부결", ok: p.ok };
}

function Minutes({ m }: { m: Meeting }) {
  const t = totals(m);
  const at = attendance(m);
  const mm = m.minutes;
  return (
    <Page>
      <h1>{meetingTitle(m)} 의사록</h1>
      <table className="f">
        <tbody>
          <tr><th>일 시</th><td>{m.date ? fmtDate(m.date) : <B w={40} />} 개회 <B v={mm.openTime ? fmtTime(mm.openTime) : ""} w={20} /> ~ 폐회 <B v={mm.closeTime ? fmtTime(mm.closeTime) : ""} w={20} /></td></tr>
          <tr><th>장 소</th><td><B v={m.place} w={60} /></td></tr>
          <tr><th>소집권자</th><td>{convenerText(m)}</td></tr>
          <tr><th>의장 / 서기</th><td>의장 <B v={mm.chair} w={30} /> / 서기 <B v={mm.secretary} w={30} /></td></tr>
        </tbody>
      </table>
      <h2>1. 성원 보고</h2>
      <table className="f grid">
        <thead><tr><th>구분</th><th>전체</th><th>직접 참석</th><th>위임</th><th>서면결의</th><th>합계</th></tr></thead>
        <tbody>
          <tr><td>구분소유자 수</td><td>{t.heads || ""}명</td><td>{at.present.heads}명</td><td>{at.proxy.heads}명</td><td>{at.written.heads}명</td><td>{at.all.heads}명 ({pct(at.all.heads, t.heads)})</td></tr>
          <tr><td>의결권(㎡)</td><td>{t.area ? fmtNum(t.area) : ""}</td><td>{fmtNum(at.present.area)}</td><td>{fmtNum(at.proxy.area)}</td><td>{fmtNum(at.written.area)}</td><td>{fmtNum(at.all.area)} ({pct(at.all.area, t.area)})</td></tr>
        </tbody>
      </table>
      <p>
        의장은 위와 같이 성원을 보고하고 {mm.openTime ? fmtTime(mm.openTime) : "　　"}에 개회를 선언하였다. 소집통지는 {m.noticeDate ? fmtDate(m.noticeDate, false) : "　　"}{" "}
        {m.noticeMethod || "내용증명 우편"}으로 하였음을 보고하였다.
      </p>
      <h2>2. 안건 심의 및 의결</h2>
      {agendas(m).map((a, i) => {
        const r = resultOf(m, a.id, a.type);
        const bm = r.y.byMode;
        return (
          <div key={a.id}>
            <h3>{agendaNo(i)}: {a.title} <span className="note">({RESOLUTION[a.type].text} 찬성 필요)</span></h3>
            <p className="pre">{m.minutes.notes[a.id] || "의장은 본 안건을 상정하고 제안 이유와 주요 내용을 설명한 뒤 질의응답을 거쳐 표결에 부쳤다."}</p>
            <table className="f grid">
              <thead><tr><th>구분</th><th>직접 참석</th><th>위임</th><th>서면결의</th><th>계(명)</th><th>의결권(㎡)</th><th>전체 대비</th></tr></thead>
              <tbody>
                {(["yes", "no", "abstain"] as const).map((v) => (
                  <tr key={v}>
                    <td>{v === "yes" ? "찬성" : v === "no" ? "반대" : "기권"}</td>
                    <td>{bm.present[v]}</td><td>{bm.proxy[v]}</td><td>{bm.written[v]}</td>
                    <td>{r.y[v].heads}</td><td className="r">{fmtNum(r.y[v].area)}</td>
                    <td>{pct(r.y[v].heads, t.heads)} / {pct(r.y[v].area, t.area)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="pass">결과: {r.label ? `${r.label}되었음을 선포하였다.` : <B w={40} />}</p>
          </div>
        );
      })}
      {mm.other && (<><h2>3. 기타</h2><p className="pre">{mm.other}</p></>)}
      <p style={{ marginTop: "4mm" }}>
        의장은 회의 목적사항을 모두 마쳤으므로 {mm.closeTime ? fmtTime(mm.closeTime) : "　　"}에 폐회를 선언하였다. 위 의사의 경과와 결과를 명확히 하기 위하여 이 의사록을 작성하고
        의장과 출석한 구분소유자 2인이 다음과 같이 서명 또는 날인한다.
      </p>
      <div className="sign-area" style={{ textAlign: "right" }}>
        <div className="date" style={{ textAlign: "center" }}>{m.date ? fmtDate(m.date, false) : "　　　　년　　월　　일"}</div>
        <p>의　　장 <B v={mm.chair} w={35} /> <span className="stamp">(서명/인)</span></p>
        <p>구분소유자 <B v={mm.signer1} w={35} /> <span className="stamp">(서명/인)</span></p>
        <p>구분소유자 <B v={mm.signer2} w={35} /> <span className="stamp">(서명/인)</span></p>
      </div>
    </Page>
  );
}

/* ---------- 10. 결과 공고문 ---------- */
function Result({ m }: { m: Meeting }) {
  const t = totals(m);
  const at = attendance(m);
  const suit = cancelSuitDeadline(m);
  return (
    <Page className="announce" org={orgName(m)}>
      <h1>관리단집회 결과 공고</h1>
      <p>
        {m.date ? fmtDate(m.date) : "　　"} {m.place}에서 개최한 {m.associationName} {meetingTitle(m)}의 결의 결과를 다음과 같이 알려 드립니다.
      </p>
      <p className="note">
        성원: 전체 구분소유자 {t.heads || "　"}명 중 {at.all.heads}명({pct(at.all.heads, t.heads)}), 의결권 {pct(at.all.area, t.area)} 참석
        (직접 {at.present.heads}명 · 위임 {at.proxy.heads}명 · 서면결의 {at.written.heads}명)
      </p>
      <table className="f grid">
        <thead><tr><th style={{ width: "18mm" }}>의안</th><th>안건</th><th style={{ width: "34mm" }}>찬성(수/의결권)</th><th style={{ width: "20mm" }}>결과</th></tr></thead>
        <tbody>
          {agendas(m).map((a, i) => {
            const r = resultOf(m, a.id, a.type);
            return (
              <tr key={a.id}>
                <td>제{i + 1}호</td>
                <td className="l">{a.title}</td>
                <td>{r.voted ? `${pct(r.y.yes.heads, t.heads)} / ${pct(r.y.yes.area, t.area)}` : ""}</td>
                <td className="pass">{r.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ol className="note">
        <li>의사록은 {m.submitPlace || "관리사무소"}에 보관되어 있으며, 이해관계인은 열람 또는 등본 교부를 청구할 수 있습니다.</li>
        <li>
          결의에 이의가 있는 구분소유자는 결의일로부터 6개월 이내{suit ? `(${fmtDate(suit, false)}까지)` : ""} 결의 취소의 소를 제기할 수 있습니다(법 제42조의2).
        </li>
      </ol>
      <div className="sign-area">
        <div className="date"><B v={m.resultDate ? fmtDate(m.resultDate, false) : ""} w={50} /></div>
      </div>
    </Page>
  );
}

/* ---------- 내보내기 ---------- */

/** 문서별 누락 항목 */
export function missing(m: Meeting, key: DocKey): string[] {
  const out: string[] = [];
  const need = (cond: boolean, label: string) => !cond && out.push(label);
  const base = () => {
    need(!!m.date, "집회 일자");
    need(!!m.place, "장소");
    need(agendas(m).length > 0, "안건");
  };
  switch (key) {
    case "notice":
      base();
      need(!!m.noticeDate, "통지일");
      need(!!m.submitDeadline, "서면결의서·위임장 제출기한");
      need(m.convener === "noManager" || m.convener === "court" ? !!m.convenerRep : !!m.managerName, "소집권자 성명");
      need(!agendas(m).some((a) => a.type === "rules" && !a.content.trim()), "규약 개정 안건의 의안 요령(개정 내용)");
      break;
    case "announce":
      base();
      need(!!m.noticeDate, "공고(통지)일");
      break;
    case "explain":
      need(agendas(m).length > 0, "안건");
      need(agendas(m).every((a) => a.reason.trim() || a.content.trim()), "안건별 제안 이유·주요 내용");
      break;
    case "proxy":
    case "written":
      base();
      need(!!m.submitDeadline, "제출기한");
      break;
    case "request":
      need(agendas(m).length > 0, "안건");
      need(!!m.convenerRep, "청구·동의 대표자");
      break;
    case "roster":
      need(m.owners.length > 0, "구분소유자 명부(없으면 빈 양식으로 출력)");
      break;
    case "minutes":
      base();
      need(!!m.minutes.chair, "의장");
      need(!!m.minutes.signer1 && !!m.minutes.signer2, "서명할 출석 구분소유자 2인");
      need(m.owners.some((o) => o.attend), "명부의 참석 방식·투표");
      break;
    case "result":
      base();
      need(m.owners.some((o) => o.attend), "명부의 참석 방식·투표");
      need(!!m.resultDate, "공고일");
      break;
  }
  return out;
}

export const PER_OWNER: DocKey[] = ["notice", "proxy", "written", "rep"];

export function DocView({ m, docKey, perOwner }: { m: Meeting; docKey: DocKey; perOwner: boolean }) {
  const owners = m.owners.filter((o) => o.unit || o.name);
  const targets: (Owner | undefined)[] =
    perOwner && PER_OWNER.includes(docKey) && owners.length
      ? docKey === "rep"
        ? owners.filter((o) => o.coOwners.trim())
        : owners
      : [undefined];
  const list = targets.length ? targets : [undefined];
  switch (docKey) {
    case "notice":
      return <>{list.map((o, i) => <Notice key={o?.id ?? i} m={m} owner={o} />)}</>;
    case "announce":
      return <Announce m={m} />;
    case "explain":
      return <Explain m={m} />;
    case "proxy":
      return <>{list.map((o, i) => <Proxy key={o?.id ?? i} m={m} owner={o} />)}</>;
    case "written":
      return <>{list.map((o, i) => <Written key={o?.id ?? i} m={m} owner={o} />)}</>;
    case "request":
      return <Request m={m} />;
    case "rep":
      return <>{list.map((o, i) => <Rep key={o?.id ?? i} m={m} owner={o} />)}</>;
    case "roster":
      return <Roster m={m} />;
    case "minutes":
      return <Minutes m={m} />;
    case "result":
      return <Result m={m} />;
  }
}
