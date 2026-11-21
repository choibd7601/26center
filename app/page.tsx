import Link from "next/link";

export default function Home() {
  return (
    <>
      <h1>26센터 관리비 청구 자동화</h1>
      <div className="cards">
        <Link className="card link" href="/electric">
          <h2>① 전기요금 단가</h2>
          <p className="muted">한전 고지서 스캔 → 당월요금계·가산금·연체료·사용량 판독 → 총금액과 kWh 단가</p>
        </Link>
        <Link className="card link" href="/water">
          <h2>② 상하수도 단가</h2>
          <p className="muted">상하수도 고지서 스캔 → 상수도·하수도·물이용부담금 단가</p>
        </Link>
        <Link className="card link" href="/expense">
          <h2>③ 경비내역서</h2>
          <p className="muted">월별 경비 입력 · 관리비부과항목별 합계 · 인쇄 / 엑셀(CSV) 저장</p>
        </Link>
        <Link className="card link" href="/meeting">
          <h2>④ 총회 준비</h2>
          <p className="muted">정기·임시총회 단계별 절차·주의사항 · 통지 기한 점검 · 정족수 계산 · 소집통지서·위임장·서면결의서·의사록 등 문서 작성</p>
        </Link>
        <Link className="card link" href="/records">
          <h2>⑤ 집합건물 회의관리</h2>
          <p className="muted">관리단집회·관리위원회 회의별 의사록·참석자 명부·결과 공고문·이행 점검표·서류 보관 표지 작성 · 서버 저장 · 회의 목록 관리</p>
        </Link>
      </div>
    </>
  );
}
