import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("auth_token")?.value;
        if (!token) {
            return NextResponse.json({ user: null }, { status: 200 });
        }

        const payload = verifyAuthToken(token);
        if (!payload) {
            return NextResponse.json({ user: null }, { status: 200 });
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
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
        return NextResponse.json({ user: null }, { status: 200 });
    }
}
