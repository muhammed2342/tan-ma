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

  const cameraActive = stream !== null;

  const fullName = useMemo(() => {
    if (!user) return "";
    return `${user.firstName} ${user.lastName}`.trim();
  }, [user]);

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
    } finally {
      setLoading(false);
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
        return;
      }

      setUser(data.user ?? null);
    } catch {
      setError("Konum alınamadı. İzin vermiş olduğundan emin ol.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Tanışma</div>
            {user ? (
              <button
                onClick={() => void handleLogout()}
                disabled={loading}
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
                type="button"
              >
                Çıkış
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {user ? (
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <img
                  src={user.photoDataUrl}
                  alt={fullName}
                  className="h-14 w-14 rounded-full border border-zinc-200 object-cover"
                />
                <div>
                  <div className="font-semibold">{fullName}</div>
                  <div className="text-sm text-zinc-600">{user.phone}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleStartMeeting()}
                disabled={loading}
                className="mt-4 w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-50"
              >
                {loading ? "Bekleniyor..." : "Tanışmayı Başla"}
              </button>
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
    </div>
  );
}
