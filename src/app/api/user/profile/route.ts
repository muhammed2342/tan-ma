import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
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

        const firstNameRaw = body.firstName;
        const lastNameRaw = body.lastName;
        const photoDataUrlRaw = body.photoDataUrl;

        const data: { firstName?: string; lastName?: string; photoDataUrl?: string } = {};

        if (firstNameRaw !== undefined) {
            const firstName = String(firstNameRaw).trim();
            if (!firstName) {
                return NextResponse.json({ error: "Ad boş olamaz" }, { status: 400 });
            }
            data.firstName = firstName;
        }

        if (lastNameRaw !== undefined) {
            const lastName = String(lastNameRaw).trim();
            if (!lastName) {
                return NextResponse.json({ error: "Soyad boş olamaz" }, { status: 400 });
            }
            data.lastName = lastName;
        }

        if (photoDataUrlRaw !== undefined) {
            const photoDataUrl = String(photoDataUrlRaw);
            if (!photoDataUrl.startsWith("data:image/")) {
                return NextResponse.json({ error: "Fotoğraf formatı geçersiz" }, { status: 400 });
            }
            data.photoDataUrl = photoDataUrl;
        }

        if (!Object.keys(data).length) {
            return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
        }

        const current = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                phone: true,
                firstName: true,
                lastName: true,
                photoDataUrl: true,
            },
        });

        if (!current) {
            return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
        }

        const profileVersionDelegate = (
            prisma as unknown as {
                userProfileVersion?: { create: (args: unknown) => Promise<unknown> };
            }
        ).userProfileVersion;

        if (!profileVersionDelegate) {
            return NextResponse.json(
                { error: "Sunucu güncelleniyor. Lütfen tekrar deneyin." },
                { status: 500 },
            );
        }

        await profileVersionDelegate.create({
            data: {
                userId: current.id,
                phone: current.phone,
                firstName: current.firstName,
                lastName: current.lastName,
                photoDataUrl: current.photoDataUrl,
            },
        });

        const user = await prisma.user.update({
            where: { id: payload.userId },
            data,
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
