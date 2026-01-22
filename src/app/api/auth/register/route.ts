import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { signAuthToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    if (!body) {
        return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }

    const phone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const photoDataUrl = String(body.photoDataUrl ?? "");

    if (!phone || !password || !firstName || !lastName || !photoDataUrl) {
        return NextResponse.json(
            { error: "Telefon, şifre, ad, soyad ve fotoğraf zorunlu" },
            { status: 400 },
        );
    }

    if (!photoDataUrl.startsWith("data:image/")) {
        return NextResponse.json(
            { error: "Fotoğraf formatı geçersiz" },
            { status: 400 },
        );
    }

    const passwordHash = await hash(password, 10);

    try {
        const user = await prisma.user.create({
            data: {
                phone,
                passwordHash,
                firstName,
                lastName,
                photoDataUrl,
            },
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

        const token = signAuthToken(user.id);
        const cookieStore = await cookies();
        cookieStore.set("auth_token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
        });

        return NextResponse.json({ user }, { status: 201 });
    } catch (err) {
        console.error(err);
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            if (err.code === "P2002") {
                return NextResponse.json(
                    { error: "Bu telefon numarası zaten kayıtlı" },
                    { status: 409 },
                );
            }
        }

        if (err instanceof Error && err.message.toLowerCase().includes("server selection")) {
            return NextResponse.json(
                { error: "Veritabanına bağlanılamadı" },
                { status: 503 },
            );
        }

        return NextResponse.json(
            { error: "Kayıt sırasında hata oluştu" },
            { status: 500 },
        );
    }
}
