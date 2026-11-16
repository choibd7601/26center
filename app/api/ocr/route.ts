import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { BILL_FIELDS, BILL_TITLES, type BillKind, type ReadResult } from "@/lib/bills";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  kind: BillKind;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  data: string; // base64
  width?: number;
  height?: number;
};

function schemaFor(kind: BillKind) {
  const keys = BILL_FIELDS[kind].map((f) => f.key);
  return {
    type: "object",
    additionalProperties: false,
    required: ["billingMonth", "fields", "warnings"],
    properties: {
      billingMonth: {
        type: ["string", "null"],
        description: "고지서의 청구(사용)년월, 예: 2026년 11월",
      },
      fields: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "text", "value", "box", "note"],
          properties: {
            key: { type: "string", enum: keys },
            text: { type: "string", description: "고지서에 인쇄된 숫자 그대로 (쉼표 포함)" },
            value: { type: ["number", "null"], description: "숫자 값. 읽을 수 없으면 null" },
            box: {
              type: ["array", "null"],
              items: { type: "integer" },
              description: "숫자가 인쇄된 위치 [x0, y0, x1, y1] (이미지 픽셀 좌표)",
            },
            note: { type: "string", description: "판독 근거나 애매한 점. 없으면 빈 문자열" },
          },
        },
      },
      warnings: { type: "array", items: { type: "string" } },
    },
  };
}

export async function POST(req: Request) {
  const accessCode = process.env.ACCESS_CODE;
  if (accessCode && req.headers.get("x-access-code") !== accessCode) {
    return NextResponse.json({ error: "접속코드가 올바르지 않습니다." }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "서버에 ANTHROPIC_API_KEY 가 설정되지 않았습니다. Vercel 환경변수를 확인하세요." },
      { status: 500 },
    );
  }

  const body = (await req.json()) as Body;
  if (!BILL_FIELDS[body.kind] || !body.data) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const fields = BILL_FIELDS[body.kind];
  const isPdf = body.mediaType === "application/pdf";
  const sizeNote =
    !isPdf && body.width && body.height
      ? `이미지 크기는 가로 ${body.width}px, 세로 ${body.height}px 입니다. box 는 이 픽셀 좌표로 숫자 글자를 감싸게 적어주세요.`
      : "PDF 이므로 box 는 null 로 두세요.";

  const prompt = [
    `이 이미지는 스캔한 ${BILL_TITLES[body.kind]}입니다. 아래 항목의 금액/수치를 읽어주세요.`,
    ...fields.map((f) => `- ${f.key}: ${f.label} (${f.unit}) — ${f.hint}`),
    "",
    "규칙:",
    "- 각 항목마다 fields 에 하나씩, 위 key 를 모두 포함하세요.",
    "- text 에는 인쇄된 그대로(쉼표 포함), value 에는 쉼표 없는 숫자를 넣으세요.",
    "- 항목이 고지서에 없거나 0/공란이면 value 를 0 으로 하고 note 에 적으세요. 읽을 수 없으면 null.",
    "- 비슷한 이름의 다른 칸(청구금액, 납기후금액, 전월 사용량 등)과 혼동하지 마세요.",
    `- ${sizeNote}`,
    "- 고지서 위에 손으로 쓴 글씨(메모, 계산)는 무시하고 인쇄된 값만 읽으세요.",
    "- 확신이 없는 값이 있으면 warnings 에 한국어로 적으세요.",
  ].join("\n");

  const client = new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: body.data } }
      : { type: "image", source: { type: "base64", media_type: body.mediaType as "image/jpeg", data: body.data } },
    { type: "text", text: prompt },
  ];

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: schemaFor(body.kind) },
      },
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "판독 요청이 거절되었습니다. 다시 시도해주세요." }, { status: 502 });
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = JSON.parse(text) as {
      billingMonth: string | null;
      fields: { key: string; text: string; value: number | null; box: number[] | null; note: string }[];
      warnings: string[];
    };

    const W = body.width || 1;
    const H = body.height || 1;
    const result: ReadResult = {
      billingMonth: parsed.billingMonth,
      warnings: parsed.warnings ?? [],
      fields: fields.map((f) => {
        const r = parsed.fields.find((x) => x.key === f.key);
        const box =
          r?.box && r.box.length === 4 && !isPdf
            ? ([r.box[0] / W, r.box[1] / H, r.box[2] / W, r.box[3] / H] as [number, number, number, number])
            : null;
        return { key: f.key, value: r?.value ?? null, text: r?.text ?? "", box, note: r?.note || undefined };
      }),
    };
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "요청이 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `판독 서버 오류 (${e.status}): ${e.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: `판독 실패: ${(e as Error).message}` }, { status: 500 });
  }
}
