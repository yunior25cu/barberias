"use client";

import { useEffect, useRef, useState } from "react";

export default function Activation() {
  const [activationToken, setActivationToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const fragmentCaptured = useRef(false);

  useEffect(() => {
    // React Strict Mode replays effects in development. Capture the fragment
    // exactly once before removing it from browser history.
    if (fragmentCaptured.current) return;
    fragmentCaptured.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const value = fragment.get("token") ?? "";
    setActivationToken(value);
    setReady(true);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    if (password !== confirmation) { setMessage("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/activar", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: activationToken, password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "No pudimos activar la cuenta.");
      window.location.replace(`/${encodeURIComponent(data.slug)}/admin`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "El enlace no es válido o venció."); }
    finally { setBusy(false); }
  }

  return <main className="shell platform-shell"><header className="topbar"><strong className="brand">Al Corte</strong></header><section className="hero" style={{ gridTemplateColumns: "1fr" }}><div><div className="eyebrow">Acceso del responsable</div><h1>Activá tu cuenta</h1><p>Elegí una contraseña de al menos 14 caracteres.</p></div></section>
    <form className="wizard platform-card" onSubmit={submit} autoComplete="new-password">
      {!ready ? <p className="notice">Verificando el enlace…</p> : !activationToken ? <p className="error" role="alert">El enlace no es válido o venció. Pedile al propietario un acceso nuevo.</p> : <>
        <div className="formrow"><label htmlFor="activation-password">Nueva contraseña</label><input id="activation-password" type="password" minLength={14} maxLength={200} required autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></div>
        <div className="formrow"><label htmlFor="activation-confirm">Repetí la contraseña</label><input id="activation-confirm" type="password" minLength={14} maxLength={200} required autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></div>
        {message && <p className="error" role="alert">{message}</p>}<button className="primary" disabled={busy}>{busy ? "Activando…" : "Activar y entrar"}</button>
      </>}
    </form><footer className="footer">El enlace de activación se usa una sola vez y vence en 24 horas.</footer></main>;
}
