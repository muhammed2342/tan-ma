import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyAuthToken } from "@/lib/auth";

export const runtime = "nodejs";

type ChatInputMessage = { role: "me" | "them"; text: string };

function localReply(personName: string, lastUserText: string) {
    const t = lastUserText.toLowerCase();
    const starters = [
        `Hmm anladım. Biraz daha açar mısın?`,
        `Güzelmiş. Peki seni en çok ne motive ediyor?`,
        `Bence de ilginç. Şu an günün nasıl gidiyor?`,
        `Ben de benzer şeyler yaşamıştım. Sen genelde ne yaparsın böyle durumlarda?`,
        `Tamamdır. Şunu merak ettim: bunu ne zamandır düşünüyorsun?`,
    ];

    if (t.includes("selam") || t.includes("merhaba") || t.includes("hey")) {
        return `Merhaba! Ben ${personName}. Nasılsın?`;
    }
    if (t.includes("nasılsın") || t.includes("naber") || t.includes("napıyorsun")) {
        return "İyiyim ya, teşekkür ederim. Sen nasılsın?";
    }
    if (t.includes("nereden") || t.includes("nerelisin")) {
        return "Ben İstanbul tarafındayım. Sen nereden yazıyorsun?";
    }
    if (t.includes("yaş") || t.includes("kaç yaş")) {
        return "Yaş muhabbetini çok sevmiyorum ama merak ettim: sen nelerden hoşlanırsın?";
    }
    if (t.includes("müzik") || t.includes("şarkı") || t.includes("spotify")) {
        return "Müzik iyi geliyor ya. En son hangi şarkıyı döngüye aldın?";
    }
    if (t.includes("film") || t.includes("dizi")) {
        return "Tam benlik konu. Son izlediğin dizi/film neydi, önerir misin?";
    }

    const pick = starters[Math.floor(Math.random() * starters.length)] ?? "Anladım. Biraz daha anlatır mısın?";
    return pick;
}

async function callOpenAI(personName: string, messages: ChatInputMessage[]) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const system = `Sen ${personName} adında gerçek bir insansın. Türkçe, samimi ve doğal konuş. Kısa cevaplar ver (1-3 cümle). Karşı tarafın yazdığına göre devam et, soru sorarak sohbeti sürdür. Asla yapay zeka olduğunu söyleme.`;

    const mapped = messages
        .slice(-20)
        .map((m) => ({ role: m.role === "me" ? "user" : "assistant", content: m.text }));

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.9,
            messages: [{ role: "system", content: system }, ...mapped],
        }),
    });

    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as
        | { choices?: Array<{ message?: { content?: string } }> }
        | null;
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return text;
}

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

        const body = (await request.json().catch(() => null)) as
            | { personName?: string; messages?: ChatInputMessage[] }
            | null;

        if (!body || !body.personName || !Array.isArray(body.messages)) {
            return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
        }

        const personName = String(body.personName).trim() || "Arkadaş";
        const messages = body.messages
            .filter((m): m is ChatInputMessage =>
                m && (m.role === "me" || m.role === "them") && typeof m.text === "string")
            .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));

        const lastUser = [...messages].reverse().find((m) => m.role === "me")?.text ?? "";

        const aiText = await callOpenAI(personName, messages).catch(() => null);
        const reply = aiText ?? localReply(personName, lastUser);

        return NextResponse.json({ reply }, { status: 200 });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
    }
}
