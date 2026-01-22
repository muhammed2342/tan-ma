import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { signAuthToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
        }

        const phone = String(body.phone ?? "").trim();
        const password = String(body.password ?? "");

        if (!phone || !password) {
            return NextResponse.json(
                { error: "Telefon ve şifre zorunlu" },
                { status: 400 },
            );
        }

        const user = await prisma.user.findUnique({
            where: { phone },
            select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
                photoDataUrl: true,
                latitude: true,
                longitude: true,
                passwordHash: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: "Telefon veya şifre hatalı" },
                { status: 401 },
            );
        }

        const ok = await compare(password, user.passwordHash);
        if (!ok) {
            return NextResponse.json(
                { error: "Telefon veya şifre hatalı" },
                { status: 401 },
            );
        }

        const token = signAuthToken(user.id);
        const cookieStore = await cookies();
        cookieStore.set("auth_token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
        });

        const safeUser = { ...user };
        delete (safeUser as { passwordHash?: string }).passwordHash;
        return NextResponse.json({ user: safeUser }, { status: 200 });
    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { error: "Sunucu hatası" },
            { status: 500 },
        );
    }
}
