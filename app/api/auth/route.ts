import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 비밀번호(ACCESS_CODE) 확인
export async function POST(req: Request) {
  const code = process.env.ACCESS_CODE;
  if (!code) {
    return NextResponse.json(
      { error: "서버에 비밀번호(ACCESS_CODE)가 설정되지 않았습니다. Vercel 환경변수에 넣어주세요." },
      { status: 503 },
    );
  }
  const { code: given } = (await req.json().catch(() => ({}))) as { code?: string };
  if (given !== code) {
    await new Promise((r) => setTimeout(r, 800)); // 연속 대입 늦추기
    return NextResponse.json({ error: "비밀번호가 맞지 않습니다." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
