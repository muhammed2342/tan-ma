"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type User = {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  photoDataUrl: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
};

type AuthMode = "login" | "register";
type RegisterStep = 1 | 2 | 3;

 type Tab = "home" | "messages" | "profile";
 type MeetingPhase = "idle" | "locating" | "searching" | "chat";

 type ChatMessage = {
  id: string;
  role: "me" | "them";
  text: string;
  createdAt: number;
 };

 type Conversation = {
  id: string;
  personName: string;
  createdAt: number;
  messages: ChatMessage[];
 };

export default function Home() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [registerStep, setRegisterStep] = useState<RegisterStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mirrorVideo, setMirrorVideo] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [meetingPhase, setMeetingPhase] = useState<MeetingPhase>("idle");
  const [searchSecondsLeft, setSearchSecondsLeft] = useState(0);
  const [searchSecondsTotal, setSearchSecondsTotal] = useState(0);

  const [chatDraft, setChatDraft] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatContext, setChatContext] = useState<"home" | "messages" | null>(null);
  const [sendingByConversationId, setSendingByConversationId] = useState<Record<string, boolean>>({});
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);

  const [profileEditing, setProfileEditing] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string>("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const searchTimeoutRef = useRef<number | null>(null);
  const searchIntervalRef = useRef<number | null>(null);

  const cameraActive = stream !== null;

  const fullName = useMemo(() => {
    if (!user) return "";
    return `${user.firstName} ${user.lastName}`.trim();
  }, [user]);

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;
    return conversations.find((c) => c.id === activeConversationId) ?? null;
  }, [activeConversationId, conversations]);

  const activeChatSending = Boolean(activeConversationId && sendingByConversationId[activeConversationId]);

  function pickPersonName(usedLower: Set<string>) {
    const firstNames = [
      "Zeynep",
      "Melisa",
      "Elif",
      "Ayşe",
      "Ece",
      "Merve",
      "Sude",
      "İrem",
      "Buse",
      "Ceren",
      "Selin",
      "Derya",
      "Yağmur",
      "Eylül",
      "Naz",
      "İlayda",
      "Azra",
      "Aslı",
      "Nisa",
      "Bahar",
    ];
    const lastNames = [
      "Yılmaz",
      "Kaya",
      "Demir",
      "Çelik",
      "Şahin",
      "Yıldız",
      "Aydın",
      "Öztürk",
      "Arslan",
      "Doğan",
      "Koç",
      "Polat",
      "Korkmaz",
      "Aksoy",
      "Eren",
      "Güneş",
      "Keskin",
      "Kara",
    ];

    for (let i = 0; i < 40; i += 1) {
      const first = firstNames[Math.floor(Math.random() * firstNames.length)] ?? "Zeynep";
      const last = lastNames[Math.floor(Math.random() * lastNames.length)] ?? "Yılmaz";
      const full = `${first} ${last}`;
      if (!usedLower.has(full.toLowerCase())) return full;
    }

    const first = firstNames[Math.floor(Math.random() * firstNames.length)] ?? "Zeynep";
    const last = lastNames[Math.floor(Math.random() * lastNames.length)] ?? "Yılmaz";
    return `${first} ${last}`;
  }

  async function readJson<T>(res: Response): Promise<T | null> {
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  async function refreshMe() {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await readJson<{ user: User | null }>(res);
    setUser(data?.user ?? null);
  }

  useEffect(() => {
    void refreshMe();
  }, []);

  useEffect(() => {
    if (!user) return;
    setActiveTab("home");
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (activeTab !== "profile") return;
    setProfileFirstName(user.firstName ?? "");
    setProfileLastName(user.lastName ?? "");
    setProfilePhotoDataUrl("");
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab !== "home") {
      if (meetingPhase === "searching") {
        cancelSearch();
      }
      if (meetingPhase === "locating") {
        setMeetingPhase("idle");
      }
      if (meetingPhase === "chat" && chatContext === "home") {
        setMeetingPhase("idle");
        setChatContext(null);
        setActiveConversationId(null);
        setChatDraft("");
      }
    }

    if (activeTab !== "messages" && chatContext === "messages") {
      setChatContext(null);
      setActiveConversationId(null);
      setChatDraft("");
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawConversations = window.localStorage.getItem("tanma_conversations");
      if (rawConversations) {
        const parsed = JSON.parse(rawConversations) as unknown;
        if (Array.isArray(parsed)) {
          const used = new Set<string>();
          let changedAny = false;
          const normalized = (parsed as Conversation[]).map((c) => {
            const oldName = String((c as { personName?: unknown }).personName ?? "").trim();
            let personName = oldName;
            const shouldRename = /\s\d+$/.test(personName) || !personName.includes(" ");
            if (shouldRename) {
              personName = pickPersonName(used);
              changedAny = true;
            }
            used.add(personName.toLowerCase());

            if (personName !== oldName && Array.isArray(c.messages) && c.messages.length) {
              const first = c.messages[0];
              if (first && first.role === "them" && typeof first.text === "string") {
                const nextText = first.text.replace(oldName, personName);
                if (nextText !== first.text) {
                  return { ...c, personName, messages: [{ ...first, text: nextText }, ...c.messages.slice(1)] };
                }
              }
            }

            return { ...c, personName };
          });

          setConversations(normalized);
          if (changedAny) {
            window.localStorage.setItem("tanma_conversations", JSON.stringify(normalized));
          }
          return;
        }
      }

      const legacy = window.localStorage.getItem("tanma_chat_messages");
      if (!legacy) return;
      const legacyParsed = JSON.parse(legacy) as unknown;
      if (!Array.isArray(legacyParsed)) return;

      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
      const migratedMessages = (legacyParsed as Array<{ id: string; role: string; text: string; createdAt: number }>).map(
        (m) =>
          ({
            id: m.id ?? String(Math.random()),
            role: m.role === "user" ? "me" : "them",
            text: String(m.text ?? ""),
            createdAt: Number(m.createdAt ?? Date.now()),
          }) satisfies ChatMessage,
      );
      const migrated: Conversation = {
        id,
        personName: "Zeynep",
        createdAt: Date.now(),
        messages: migratedMessages,
      };
      setConversations([migrated]);
      window.localStorage.setItem("tanma_conversations", JSON.stringify([migrated]));
    } catch {
      // ignore
      return;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("tanma_conversations", JSON.stringify(conversations));
    } catch {
      // ignore
      return;
    }
  }, [conversations]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (!chatListRef.current) return;
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [activeConversation?.messages.length, meetingPhase]);

  useEffect(() => {
    if (mode === "register") {
      setRegisterStep(1);
    }
  }, [mode]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
      if (searchIntervalRef.current) window.clearInterval(searchIntervalRef.current);
      searchTimeoutRef.current = null;
      searchIntervalRef.current = null;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      video.srcObject = null;
      return;
    }

    video.srcObject = stream;
    void video.play().catch(() => null);
  }, [stream]);

  async function startCamera() {
    setError(null);
    try {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setError("Kamera için HTTPS gerekir. Telefondan açarken güvenli (https) bir link kullanmalısın.");
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        setMirrorVideo(true);
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        setMirrorVideo(false);
      }

      const track = stream.getVideoTracks()[0];
      const facing = track?.getSettings?.().facingMode;
      if (facing === "user") setMirrorVideo(true);
      if (facing === "environment") setMirrorVideo(false);

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      setStream(stream);
    } catch {
      setError("Kameraya erişilemedi. Tarayıcı iznini kontrol et.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }

  function capturePhoto() {
    setError(null);
    const video = videoRef.current;
    if (!video) {
      setError("Kamera hazır değil");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Fotoğraf alınamadı");
      return;
    }
    if (mirrorVideo) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPhotoDataUrl(dataUrl);
    stopCamera();
  }

  function captureProfilePhoto() {
    setProfileError(null);
    const video = videoRef.current;
    if (!video) {
      setProfileError("Kamera hazır değil");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setProfileError("Fotoğraf alınamadı");
      return;
    }
    if (mirrorVideo) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setProfilePhotoDataUrl(dataUrl);
    stopCamera();
  }

  async function handleRegister() {
    setLoading(true);
    setError(null);
    try {
      if (password !== confirmPassword) {
        setError("Şifreler aynı değil");
        return;
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone,
          password,
          firstName,
          lastName,
          photoDataUrl,
        }),
      });
      const data = await readJson<{ user?: User; error?: string }>(res);
      if (!data) {
        setError("Sunucu yanıtı okunamadı");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Kayıt başarısız");
        return;
      }
      setUser(data.user ?? null);
      setPassword("");
      setConfirmPassword("");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await readJson<{ user?: User; error?: string }>(res);
      if (!data) {
        setError("Sunucu yanıtı okunamadı");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Giriş başarısız");
        return;
      }
      setUser(data.user ?? null);
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setPassword("");
      setMeetingPhase("idle");
      setActiveTab("home");
      setActiveConversationId(null);
      setProfileEditing(false);
      setProfileError(null);
      setProfilePhotoDataUrl("");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!user) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const firstName = profileFirstName.trim();
      const lastName = profileLastName.trim();
      if (!firstName || !lastName) {
        setProfileError("Ad ve soyad boş olamaz");
        return;
      }

      const payload: { firstName: string; lastName: string; photoDataUrl?: string } = { firstName, lastName };
      if (profilePhotoDataUrl) {
        payload.photoDataUrl = profilePhotoDataUrl;
      }

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson<{ user?: User; error?: string }>(res);
      if (!data) {
        setProfileError("Sunucu yanıtı okunamadı");
        return;
      }
      if (!res.ok) {
        setProfileError(data.error ?? "Profil güncellenemedi");
        return;
      }

      setUser(data.user ?? null);
      setProfileEditing(false);
      setProfilePhotoDataUrl("");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleStartMeeting() {
    setLoading(true);
    setError(null);
    try {
      if (!navigator.geolocation) {
        setError("Bu tarayıcı konum özelliğini desteklemiyor");
        return;
      }

      setMeetingPhase("locating");

      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const res = await fetch("/api/user/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      });

      const data = await readJson<{ user?: User; error?: string }>(res);
      if (!data) {
        setError("Sunucu yanıtı okunamadı");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Konum kaydedilemedi");
        setMeetingPhase("idle");
        return;
      }

      setUser(data.user ?? null);

      const durationMs = 12000;
      const seconds = Math.max(1, Math.ceil(durationMs / 1000));

      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
      if (searchIntervalRef.current) window.clearInterval(searchIntervalRef.current);

      setSearchSecondsLeft(seconds);
      setSearchSecondsTotal(seconds);
      setMeetingPhase("searching");

      searchIntervalRef.current = window.setInterval(() => {
        setSearchSecondsLeft((s) => Math.max(0, s - 1));
      }, 1000);

      searchTimeoutRef.current = window.setTimeout(() => {
        if (searchIntervalRef.current) window.clearInterval(searchIntervalRef.current);
        searchIntervalRef.current = null;
        searchTimeoutRef.current = null;
        const used = new Set(conversationsRef.current.map((c) => c.personName.toLowerCase()));
        const pick = pickPersonName(used);

        const convId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
        const welcomeId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + 1);
        const welcome: ChatMessage = {
          id: welcomeId,
          role: "them",
          text: `Merhaba ben ${pick}. Tanıştığıma sevindim. Sen neler yapıyorsun?`,
          createdAt: Date.now(),
        };
        const newConversation: Conversation = {
          id: convId,
          personName: pick,
          createdAt: Date.now(),
          messages: [welcome],
        };
        setConversations((prev) => [newConversation, ...prev]);
        setActiveConversationId(convId);
        setChatContext("home");
        setMeetingPhase("chat");
      }, durationMs);
    } catch {
      setError("Konum alınamadı. İzin vermiş olduğundan emin ol.");
      setMeetingPhase("idle");
    } finally {
      setLoading(false);
    }
  }

  function cancelSearch() {
    if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    if (searchIntervalRef.current) window.clearInterval(searchIntervalRef.current);
    searchTimeoutRef.current = null;
    searchIntervalRef.current = null;
    setSearchSecondsLeft(0);
    setSearchSecondsTotal(0);
    setMeetingPhase("idle");
    if (chatContext === "home") {
      setChatContext(null);
      setActiveConversationId(null);
    }
  }

  function autoReplyTo(personName: string, text: string) {
    const candidates = [
      "Anladım. Biraz daha anlatmak ister misin?",
      "Güzel! Bugün günün nasıl geçti?",
      "Harika. Neler yapmaktan hoşlanırsın?",
      "Bunu duymak iyi geldi. Şu an nereden yazıyorsun?",
      "Sence tanışmalarda en önemli şey ne?",
    ];
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const t = text.toLowerCase();
    if (t.includes("selam") || t.includes("merhaba")) {
      return `Merhaba! Ben ${personName}. Adını söyler misin?`;
    }
    if (t.includes("nasılsın") || t.includes("naber")) {
      return "İyiyim teşekkür ederim :) Sen nasılsın?";
    }
    if (t.includes("nerelisin") || t.includes("nereden")) {
      return "Ben İstanbul'dayım. Sen nereden yazıyorsun?";
    }
    if (t.includes("yaş") || t.includes("kaç yaş")) {
      return "Yaşı çok konuşmayalım :) Sen bugün neler yaptın?";
    }
    return pick;
  }

  function appendMessageToConversation(conversationId: string, message: ChatMessage) {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conversationId);
      if (idx === -1) return prev;
      const target = prev[idx];
      const updated = { ...target, messages: [...target.messages, message] };
      const rest = prev.filter((c) => c.id !== conversationId);
      return [updated, ...rest];
    });
  }

  async function sendChat() {
    const text = chatDraft.trim();
    if (!text) return;
    if (!activeConversationId) return;

    const conversationId = activeConversationId;
    if (sendingByConversationId[conversationId]) return;
    const personName =
      conversationsRef.current.find((c) => c.id === conversationId)?.personName ?? "";

    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
    const msg: ChatMessage = { id, role: "me", text, createdAt: Date.now() };
    appendMessageToConversation(conversationId, msg);
    setChatDraft("");

    setSendingByConversationId((prev) => ({ ...prev, [conversationId]: true }));
    try {
      const snapshot = conversationsRef.current.find((c) => c.id === conversationId);
      const history = snapshot?.messages ?? [];
      const payload = {
        personName,
        messages: [...history, msg].slice(-20).map((m) => ({ role: m.role, text: m.text })),
      };
      let replyText = autoReplyTo(personName, text);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await readJson<{ reply?: string; error?: string }>(res);
        if (res.ok && data?.reply) {
          replyText = data.reply;
        }
      } catch {
      }

      const rid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + 1);
      const rmsg: ChatMessage = { id: rid, role: "them", text: replyText, createdAt: Date.now() };
      appendMessageToConversation(conversationId, rmsg);
    } finally {
      setSendingByConversationId((prev) => ({ ...prev, [conversationId]: false }));
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 pb-28 pt-10 text-zinc-900">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Tanışma</div>
            {user ? (
              <div className="text-xs font-medium text-zinc-500">
                {activeTab === "home"
                  ? "Ana Sayfa"
                  : activeTab === "messages"
                    ? "Mesajlar"
                    : "Profil"}
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {user ? (
            <div className="mt-6">
              {activeTab === "home" ? (
                <div>
                  {meetingPhase === "idle" ? (
                    <button
                      type="button"
                      onClick={() => void handleStartMeeting()}
                      disabled={loading}
                      className="mt-4 w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-50"
                    >
                      {loading ? "Bekleniyor..." : "Tanışmayı Başla"}
                    </button>
                  ) : null}

                  {meetingPhase === "locating" ? (
                    <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">Konum alınıyor…</div>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                      </div>
                      <div className="mt-2 text-xs text-zinc-600">İzin verdiğinden emin ol.</div>
                    </div>
                  ) : null}

                  {meetingPhase === "searching" ? (
                    <div className="mt-6">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="text-sm font-semibold">Arkadaş aranıyor…</div>
                        <div className="mt-1 text-xs text-zinc-600">
                          Yaklaşık {Math.max(1, searchSecondsLeft)} sn
                        </div>

                        <div className="mt-4 flex justify-center">
                          <div className="relative h-44 w-44 overflow-hidden rounded-full border border-zinc-200 bg-gradient-to-b from-sky-400 to-indigo-700 shadow-inner">
                            <div
                              className="absolute inset-0"
                              style={{
                                backgroundImage:
                                  "radial-gradient(circle at 30% 28%, rgba(255,255,255,0.75), transparent 55%), radial-gradient(circle at 70% 80%, rgba(0,0,0,0.18), transparent 45%)",
                              }}
                            />
                            <div
                              className="absolute inset-0 opacity-35"
                              style={{
                                backgroundImage:
                                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 1px, transparent 1px, transparent 18px), repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 1px, transparent 1px, transparent 18px)",
                              }}
                            />
                            <div className="absolute inset-0 opacity-25">
                              <div
                                className="absolute inset-0"
                                style={{
                                  backgroundImage:
                                    "radial-gradient(circle at 50% 50%, transparent 58%, rgba(255,255,255,0.22) 60%, transparent 62%)",
                                }}
                              />
                            </div>

                            <div className="absolute inset-0 animate-spin" style={{ animationDuration: "18s" }}>
                              <svg
                                className="h-full w-full"
                                viewBox="0 0 200 200"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                              >
                                <defs>
                                  <clipPath id="globeClip">
                                    <circle cx="100" cy="100" r="100" />
                                  </clipPath>
                                  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="0.8" />
                                  </filter>
                                </defs>
                                <g clipPath="url(#globeClip)">
                                  <g filter="url(#soft)">
                                    <path
                                      d="M24 92c10-22 30-34 54-38 14-2 18 6 12 14-10 12-14 26-10 40 4 14-2 22-18 22-12 0-26-10-38-22-6-6-6-10 0-16Z"
                                      fill="rgba(34,197,94,0.72)"
                                    />
                                    <path
                                      d="M92 62c10-14 26-22 44-20 18 2 28 14 20 24-6 8-10 18-6 26 6 14 0 26-18 28-16 2-30-8-40-18-8-8-8-26 0-40Z"
                                      fill="rgba(34,197,94,0.68)"
                                    />
                                    <path
                                      d="M132 112c16-6 28 4 34 18 8 18-2 34-22 36-20 2-34-14-30-30 2-10 8-18 18-24Z"
                                      fill="rgba(34,197,94,0.65)"
                                    />
                                    <path
                                      d="M60 132c8-6 18-6 26 0 8 6 10 16 4 24-8 10-24 12-34 4-8-8-6-18 4-28Z"
                                      fill="rgba(34,197,94,0.55)"
                                    />
                                  </g>
                                  <path
                                    d="M0 118c26-10 52-10 78 0 12 4 26 4 44 0 24-6 48-6 78 0"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.18)"
                                    strokeWidth="2"
                                  />
                                </g>
                              </svg>
                            </div>

                            <div
                              className="absolute inset-0"
                              style={{
                                boxShadow:
                                  "inset 0 0 28px rgba(0,0,0,0.22), inset 0 0 60px rgba(0,0,0,0.18)",
                              }}
                            />
                          </div>
                        </div>

                        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full bg-black"
                            style={{
                              width: `${
                                Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    (searchSecondsTotal
                                      ? (searchSecondsLeft / searchSecondsTotal) * 100
                                      : 0),
                                  ),
                                )
                              }%`,
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={cancelSearch}
                          className="mt-4 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                        >
                          İptal
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {meetingPhase === "chat" && chatContext === "home" ? (
                    <div className="mt-6">
                      <div className="rounded-2xl border border-zinc-200 bg-white">
                        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                          <div>
                            <div className="text-sm font-semibold">{activeConversation?.personName ?? "Sohbet"}</div>
                            <div className="text-xs text-zinc-500">Sohbet</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setMeetingPhase("idle");
                              setChatContext(null);
                              setActiveConversationId(null);
                              setChatDraft("");
                            }}
                            className="text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                          >
                            Kapat
                          </button>
                        </div>

                        <div ref={chatListRef} className="max-h-[46vh] overflow-y-auto px-4 py-3">
                          {activeConversation?.messages.length ? (
                            <div className="space-y-2">
                              {activeConversation.messages.map((m) => (
                                <div
                                  key={m.id}
                                  className={`flex ${m.role === "me" ? "justify-end" : "justify-start"}`}
                                >
                                  <div
                                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                                      m.role === "me"
                                        ? "bg-black text-white"
                                        : "bg-zinc-100 text-zinc-900"
                                    }`}
                                  >
                                    {m.text}
                                  </div>
                                </div>
                              ))}
                              {activeChatSending ? (
                                <div className="flex justify-start">
                                  <div className="max-w-[80%] rounded-2xl bg-zinc-100 px-3 py-2 text-sm leading-relaxed text-zinc-900">
                                    Yazıyor...
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="text-sm text-zinc-600">Henüz mesaj yok.</div>
                          )}
                        </div>

                        <div className="border-t border-zinc-100 p-3">
                          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                            <input
                              value={chatDraft}
                              onChange={(e) => setChatDraft(e.target.value)}
                              disabled={activeChatSending}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void sendChat();
                                }
                              }}
                              placeholder="Mesaj yaz…"
                              className="min-w-0 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                            />
                            <button
                              type="button"
                              onClick={() => void sendChat()}
                              disabled={activeChatSending}
                              className="shrink-0 whitespace-nowrap rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                            >
                              Gönder
                            </button>
                          </div>
                          <div className="mt-2 text-xs text-zinc-500">Mesajlar cihazında kaydedilir (şimdilik).</div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : activeTab === "messages" ? (
                <div>
                  <div className="text-sm font-semibold">Mesajlar</div>

                  {activeConversationId && chatContext === "messages" ? (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setChatContext(null);
                          setActiveConversationId(null);
                          setChatDraft("");
                        }}
                        className="mb-3 inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M15 18l-6-6 6-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Geri
                      </button>
                      <div className="rounded-2xl border border-zinc-200 bg-white">
                        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                          <div>
                            <div className="text-sm font-semibold">{activeConversation?.personName ?? "Sohbet"}</div>
                            <div className="text-xs text-zinc-500">Sohbet</div>
                          </div>
                        </div>
                        <div ref={chatListRef} className="max-h-[48vh] overflow-y-auto px-4 py-3">
                          {activeConversation?.messages.length ? (
                            <div className="space-y-2">
                              {activeConversation.messages.map((m) => (
                                <div
                                  key={m.id}
                                  className={`flex ${m.role === "me" ? "justify-end" : "justify-start"}`}
                                >
                                  <div
                                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                                      m.role === "me"
                                        ? "bg-black text-white"
                                        : "bg-zinc-100 text-zinc-900"
                                    }`}
                                  >
                                    {m.text}
                                  </div>
                                </div>
                              ))}
                              {activeChatSending ? (
                                <div className="flex justify-start">
                                  <div className="max-w-[80%] rounded-2xl bg-zinc-100 px-3 py-2 text-sm leading-relaxed text-zinc-900">
                                    Yazıyor...
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="text-sm text-zinc-600">Henüz mesaj yok.</div>
                          )}
                        </div>
                        <div className="border-t border-zinc-100 p-3">
                          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                            <input
                              value={chatDraft}
                              onChange={(e) => setChatDraft(e.target.value)}
                              disabled={activeChatSending}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void sendChat();
                                }
                              }}
                              placeholder="Mesaj yaz…"
                              className="min-w-0 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                            />
                            <button
                              type="button"
                              onClick={() => void sendChat()}
                              disabled={activeChatSending}
                              className="shrink-0 whitespace-nowrap rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                            >
                              Gönder
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {conversations.length ? (
                        conversations.map((c) => {
                          const last = c.messages[c.messages.length - 1];
                          const preview = last ? last.text.slice(0, 60) : "";
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setActiveConversationId(c.id);
                                setChatContext("messages");
                                setChatDraft("");
                              }}
                              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left hover:bg-zinc-100"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
                                  {c.personName.slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold">{c.personName}</div>
                                  <div className="mt-1 truncate text-xs text-zinc-600">
                                    {preview || "Henüz konuşma yok"}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-600">
                          Henüz konuşma yok.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {profileError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {profileError}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-xs font-medium text-zinc-600">Profil</div>

                    {profileEditing ? (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={profilePhotoDataUrl || user.photoDataUrl}
                            alt={fullName}
                            className="h-12 w-12 rounded-full border border-zinc-200 object-cover"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{fullName}</div>
                            <div className="mt-1 truncate text-xs text-zinc-600">{user.phone}</div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-zinc-200 bg-white p-3">
                          <div className="text-sm font-medium">Profil Fotoğrafı</div>
                          <div className="mt-2">
                            {cameraActive ? (
                              <div>
                                <video
                                  ref={videoRef}
                                  className="h-40 w-full rounded-lg border border-zinc-200 object-cover"
                                  style={{ transform: mirrorVideo ? "scaleX(-1)" : undefined }}
                                  playsInline
                                  autoPlay
                                  muted
                                />
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                  <button
                                    type="button"
                                    onClick={captureProfilePhoto}
                                    className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                                  >
                                    Çek
                                  </button>
                                  <button
                                    type="button"
                                    onClick={stopCamera}
                                    className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                                  >
                                    Kapat
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-3">
                                <button
                                  type="button"
                                  onClick={() => void startCamera()}
                                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                                >
                                  Kamera Aç
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setProfilePhotoDataUrl("")}
                                  disabled={!profilePhotoDataUrl}
                                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                                >
                                  Yeniden Çek
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-sm font-medium">Ad</label>
                            <input
                              value={profileFirstName}
                              onChange={(e) => setProfileFirstName(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 outline-none focus:border-zinc-400"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Soyad</label>
                            <input
                              value={profileLastName}
                              onChange={(e) => setProfileLastName(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 outline-none focus:border-zinc-400"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setProfileEditing(false);
                              setProfileError(null);
                              setProfileFirstName(user.firstName ?? "");
                              setProfileLastName(user.lastName ?? "");
                              setProfilePhotoDataUrl("");
                              stopCamera();
                            }}
                            disabled={profileSaving}
                            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
                          >
                            İptal
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveProfile()}
                            disabled={profileSaving}
                            className="rounded-xl bg-black px-4 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                          >
                            {profileSaving ? "Kaydediliyor..." : "Kaydet"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.photoDataUrl}
                            alt={fullName}
                            className="h-12 w-12 rounded-full border border-zinc-200 object-cover"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{fullName}</div>
                            <div className="mt-1 truncate text-xs text-zinc-600">{user.phone}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileEditing(true);
                            setProfileError(null);
                            setProfileFirstName(user.firstName ?? "");
                            setProfileLastName(user.lastName ?? "");
                          }}
                          className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
                        >
                          Profili Güncelle
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={loading}
                    className="mt-4 w-full rounded-xl bg-black px-4 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex rounded-xl border border-zinc-200 bg-zinc-50 p-1">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                    mode === "login" ? "bg-white shadow-sm" : "text-zinc-600"
                  }`}
                >
                  Giriş
                </button>
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                    mode === "register"
                      ? "bg-white shadow-sm"
                      : "text-zinc-600"
                  }`}
                >
                  Hesap Oluştur
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {mode === "register" ? (
                  <div className="text-xs font-medium text-zinc-600">
                    Adım {registerStep}/3
                  </div>
                ) : null}

                {mode === "login" || registerStep === 1 ? (
                  <>
                    <div>
                      <label className="text-sm font-medium">Telefon</label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="05xx..."
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-zinc-400"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Şifre</label>
                      <div className="relative mt-1">
                        <input
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          type={showPassword ? "text" : "password"}
                          className="w-full rounded-xl border border-zinc-200 px-3 py-2 pr-20 outline-none focus:border-zinc-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                        >
                          {showPassword ? "Gizle" : "Göster"}
                        </button>
                      </div>
                    </div>

                    {mode === "register" ? (
                      <div>
                        <label className="text-sm font-medium">Şifre (Tekrar)</label>
                        <div className="relative mt-1">
                          <input
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            type={showConfirmPassword ? "text" : "password"}
                            className="w-full rounded-xl border border-zinc-200 px-3 py-2 pr-20 outline-none focus:border-zinc-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                          >
                            {showConfirmPassword ? "Gizle" : "Göster"}
                          </button>
                        </div>
                        {confirmPassword && password !== confirmPassword ? (
                          <div className="mt-2 text-xs text-red-700">Şifreler aynı değil</div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {mode === "register" && registerStep === 2 ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Ad</label>
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-zinc-400"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Soyad</label>
                      <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:border-zinc-400"
                      />
                    </div>
                  </div>
                ) : null}

                {mode === "register" && registerStep === 3 ? (
                  <div>
                    <label className="text-sm font-medium">Profil Fotoğrafı</label>
                    <div className="mt-2 rounded-xl border border-zinc-200 p-3">
                      {photoDataUrl ? (
                        <img
                          src={photoDataUrl}
                          alt="Profil"
                          className="h-40 w-full rounded-lg border border-zinc-200 object-cover"
                        />
                      ) : null}

                      {cameraActive ? (
                        <div className="mt-3">
                          <video
                            ref={videoRef}
                            className="h-40 w-full rounded-lg border border-zinc-200 object-cover"
                            style={{ transform: mirrorVideo ? "scaleX(-1)" : undefined }}
                            playsInline
                            autoPlay
                            muted
                          />
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={capturePhoto}
                              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                            >
                              Çek
                            </button>
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                            >
                              Kapat
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => void startCamera()}
                            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                          >
                            Kamera Aç
                          </button>
                          <button
                            type="button"
                            onClick={() => setPhotoDataUrl("")}
                            disabled={!photoDataUrl}
                            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                          >
                            Yeniden Çek
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {mode === "login" ? (
                  <button
                    type="button"
                    onClick={() => void handleLogin()}
                    disabled={loading}
                    className="mt-2 w-full rounded-xl bg-black px-4 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Giriş Yap
                  </button>
                ) : registerStep === 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setRegisterStep(2);
                    }}
                    disabled={
                      loading ||
                      !phone ||
                      !password ||
                      !confirmPassword ||
                      password !== confirmPassword
                    }
                    className="mt-2 w-full rounded-xl bg-black px-4 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Devam
                  </button>
                ) : registerStep === 2 ? (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setRegisterStep(1);
                      }}
                      disabled={loading}
                      className="rounded-xl border border-zinc-200 px-4 py-3 text-center text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Geri
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setRegisterStep(3);
                      }}
                      disabled={loading || !firstName.trim() || !lastName.trim()}
                      className="rounded-xl bg-black px-4 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                    >
                      Devam
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setRegisterStep(2);
                      }}
                      disabled={loading}
                      className="rounded-xl border border-zinc-200 px-4 py-3 text-center text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Geri
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRegister()}
                      disabled={
                        loading ||
                        !photoDataUrl ||
                        !confirmPassword ||
                        password !== confirmPassword ||
                        !firstName.trim() ||
                        !lastName.trim() ||
                        !phone
                      }
                      className="rounded-xl bg-black px-4 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                    >
                      Hesap Oluştur
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-zinc-500">
          Profil fotoğrafı sadece kamera ile alınır.
        </div>
      </div>

      {user ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white px-4 py-3">
          <div className="mx-auto flex w-full max-w-md items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveTab("home")}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold ${
                activeTab === "home" ? "text-zinc-900" : "text-zinc-500"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              Home
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("messages")}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold ${
                activeTab === "messages" ? "text-zinc-900" : "text-zinc-500"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H6a2 2 0 0 1-2-2V5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              Mesaj
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold ${
                activeTab === "profile" ? "text-zinc-900" : "text-zinc-500"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M20 21a8 8 0 1 0-16 0"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              Profil
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
