import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("auth_token")?.value;
        if (!token) {
            return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
        }

        const payload = verifyAuthToken(token);
        if (!payload) {
            return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
        }

        const latitude = Number(body.latitude);
        const longitude = Number(body.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return NextResponse.json(
                { error: "Konum bilgisi geçersiz" },
                { status: 400 },
            );
        }

        const user = await prisma.user.update({
            where: { id: payload.userId },
            data: { latitude, longitude },
            select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
                photoDataUrl: true,
                latitude: true,
                longitude: true,
                createdAt: true,
            },
        });

        return NextResponse.json({ user }, { status: 200 });
    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { error: "Sunucu hatası" },
            { status: 500 },
        );
    }
}
