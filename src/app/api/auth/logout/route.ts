import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
    const cookieStore = await cookies();
    cookieStore.delete("auth_token");
    return NextResponse.json({ ok: true }, { status: 200 });
}
