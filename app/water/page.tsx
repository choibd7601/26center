"use client";

import BillReader from "@/components/BillReader";
import { calcWater, fmt } from "@/lib/bills";

export default function WaterPage() {
  return (
    <>
      <h1>상하수도 요금 단가</h1>
      <p className="muted">각 단가 = 요금 ÷ 사용량 (상수도요금 · 하수도요금 · 물이용부담금)</p>
      <BillReader
        kind="water"
        renderResult={(v) => {
          const r = calcWater(v);
          const rows: [string, number | null, number | null][] = [
            ["상수도요금", v.waterFee, r.water],
            ["하수도요금", v.sewerFee, r.sewer],
            ["물이용부담금", v.waterUseCharge, r.waterUse],
          ];
          return (
            <div className="stats">
              {rows.map(([label, amt, unit]) => (
                <div className="stat" key={label}>
                  <div className="label">{label} 단가</div>
                  <div className="value">{unit == null ? "-" : `${fmt(Math.round(unit))} 원`}</div>
                  <div className="muted small">
                    {fmt(amt)} ÷ {fmt(v.usage)} = {fmt(unit, 2)}
                  </div>
                </div>
              ))}
              <div className="stat">
                <div className="label">요금 합계</div>
                <div className="value">{fmt(r.total)} 원</div>
                <div className="muted small">사용량 {fmt(v.usage)}</div>
              </div>
            </div>
          );
        }}
        historyRow={(v) => {
          const r = calcWater(v);
          return {
            사용량: fmt(v.usage),
            상수도요금: fmt(v.waterFee),
            상수도단가: fmt(r.water == null ? null : Math.round(r.water)),
            하수도요금: fmt(v.sewerFee),
            하수도단가: fmt(r.sewer == null ? null : Math.round(r.sewer)),
            물이용부담금: fmt(v.waterUseCharge),
            물이용단가: fmt(r.waterUse == null ? null : Math.round(r.waterUse)),
          };
        }}
      />
    </>
  );
}
