"use client";

import { useCallback, useEffect, useState } from "react";

type Business = { id: string; slug: string; status: "active" | "inactive"; createdAt: string; publicUrl?: string; adminUrl?: string; settings: { businessName: string; publicPhone: string | null } | null };
type Detail = Business & { settings: { businessName: string; publicPhone: string | null; timezone: string; currency: string; minAdvanceMinutes: number; maxAdvanceDays: number; slotStepMinutes: number } | null; audits: { id: string; action: string; result: string; changesJson: string | null; createdAt: string; actor: { username: string } }[] };
type Provision = { business: Business; activationLink: string | null; expiresAt?: string; created: boolean };
type NewBusiness = { businessName: string; slug: string; username: string; publicPhone: string; currency: string };
const empty: NewBusiness = { businessName: "", slug: "", username: "", publicPhone: "", currency: "UYU" };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "No pudimos completar la operación.");
  return data as T;
}

export default function Platform() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [rows, setRows] = useState<Business[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [activation, setActivation] = useState<Provision | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [pending, setPending] = useState<{ key: string; payload: NewBusiness } | null>(null);

  const loadBusinesses = useCallback(async () => {
    const data = await api<{ businesses: Business[]; pages: number; total: number }>(`/api/plataforma/businesses?page=${page}&q=${encodeURIComponent(q)}&status=${status}`);
    setRows(data.businesses); setPages(data.pages); setTotal(data.total);
  }, [page, q, status]);
  const loadDetail = useCallback(async (id: string) => {
    const data = await api<{ business: Detail }>(`/api/plataforma/businesses/${encodeURIComponent(id)}`);
    setDetail(data.business);
  }, []);

  useEffect(() => {
    let alive = true;
    api<{ authenticated: boolean }>("/api/plataforma/session").then(() => { if (alive) setAuthenticated(true); }).catch(() => { if (alive) setAuthenticated(false); });
    try {
      const saved = sessionStorage.getItem("alcorte-pending-provision");
      if (saved) { const parsed = JSON.parse(saved) as { key: string; payload: NewBusiness }; window.setTimeout(() => setPending(parsed), 0); }
    } catch { /* storage can be disabled */ }
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const timer = window.setTimeout(() => loadBusinesses().catch(error => setErrorMessage(error instanceof Error ? error.message : "No pudimos cargar los negocios.")), 0);
    return () => window.clearTimeout(timer);
  }, [authenticated, loadBusinesses]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setErrorMessage("");
    try { await api("/api/plataforma/login", { method: "POST", body: JSON.stringify({ username, password }) }); setPassword(""); setAuthenticated(true); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : "No pudimos iniciar sesión."); }
  }

  async function create(pendingRequest?: { key: string; payload: NewBusiness }) {
    setErrorMessage(""); setMessage("");
    const payload = pendingRequest?.payload ?? form;
    const current = pendingRequest ?? { key: crypto.randomUUID(), payload };
    setPending(current);
    try { sessionStorage.setItem("alcorte-pending-provision", JSON.stringify(current)); } catch { /* optional retry persistence */ }
    try {
      const result = await api<Provision>("/api/plataforma/businesses", { method: "POST", headers: { "Idempotency-Key": current.key }, body: JSON.stringify(payload) });
      setActivation(result); setForm(empty); setPending(null);
      try { sessionStorage.removeItem("alcorte-pending-provision"); } catch { /* optional retry persistence */ }
      setMessage(result.created ? "Negocio creado. Compartí manualmente el enlace temporal con su responsable." : "El negocio ya estaba creado. Emití un nuevo acceso si el enlace original se perdió.");
      await loadBusinesses();
      if (result.business) await loadDetail(result.business.id);
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "No pudimos crear el negocio."); }
  }

  async function updateBusiness(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!detail) return;
    const data = new FormData(event.currentTarget);
    try {
      await api(`/api/plataforma/businesses/${encodeURIComponent(detail.id)}`, { method: "PATCH", body: JSON.stringify({ businessName: String(data.get("businessName") ?? ""), publicPhone: String(data.get("publicPhone") ?? "") || null }) });
      setMessage("Cambios guardados."); await loadDetail(detail.id); await loadBusinesses();
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "No pudimos guardar."); }
  }

  async function toggleStatus() {
    if (!detail) return;
    const next = detail.status === "active" ? "inactive" : "active";
    const confirmation = next === "inactive"
      ? "¿Desactivar este negocio? Se conservarán reservas y datos, pero el panel y los enlaces públicos dejarán de funcionar hasta reactivarlo."
      : "¿Reactivar este negocio? Su responsable tendrá que iniciar sesión nuevamente.";
    if (!window.confirm(confirmation)) return;
    try { await api(`/api/plataforma/businesses/${encodeURIComponent(detail.id)}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }); setMessage(next === "inactive" ? "Negocio desactivado." : "Negocio reactivado."); await loadDetail(detail.id); await loadBusinesses(); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : "No pudimos cambiar el estado."); }
  }

  async function issueActivation() {
    if (!detail || !window.confirm("El enlace anterior quedará invalidado y el responsable deberá volver a activar su cuenta. ¿Emitir un enlace nuevo?")) return;
    try { const result = await api<{ activationLink: string; expiresAt: string }>(`/api/plataforma/businesses/${encodeURIComponent(detail.id)}/activation`, { method: "POST", body: JSON.stringify({ confirm: true }) }); setActivation({ created: false, business: detail, ...result }); setMessage("Nuevo acceso temporal emitido. La cuenta requiere activación."); await loadDetail(detail.id); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : "No pudimos emitir el acceso."); }
  }

  async function logout() {
    try { await api("/api/plataforma/logout", { method: "POST", body: "{}" }); } finally { setAuthenticated(false); setRows([]); setDetail(null); }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(`${location.origin}${value.startsWith("/") ? value : `/${value}`}`); setMessage("Enlace copiado."); }
    catch { setMessage("No se pudo copiar. Seleccioná el enlace y copialo."); }
  }

  if (authenticated === null) return <main className="shell platform-shell"><p className="notice">Verificando el acceso…</p></main>;
  if (!authenticated) return <main className="shell platform-shell"><header className="topbar"><strong className="brand">Administración de negocios</strong></header><section className="hero" style={{ gridTemplateColumns: "1fr" }}><div><div className="eyebrow">Al Corte · Plataforma</div><h1>Administración de negocios</h1><p>Ingresá con la cuenta del propietario de la aplicación.</p></div></section><form className="wizard platform-card" onSubmit={login}><div className="formrow"><label htmlFor="platform-user">Usuario</label><input id="platform-user" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} /></div><div className="formrow"><label htmlFor="platform-password">Contraseña</label><input id="platform-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></div>{errorMessage && <p className="error" role="alert">{errorMessage}</p>}<button className="primary">Entrar</button></form></main>;

  return <main className="shell platform-shell"><header className="topbar"><strong className="brand">Administración de negocios</strong><button className="secondary" onClick={logout}>Salir</button></header>
    <section className="hero" style={{ gridTemplateColumns: "1fr" }}><div><div className="eyebrow">Al Corte · Plataforma</div><h1>Negocios</h1><p>Creá accesos para responsables y administrá los enlaces de cada local.</p></div></section>
    {errorMessage && <p className="error" role="alert">{errorMessage}</p>}{message && <p className="notice" role="status">{message}</p>}
    {activation?.activationLink && <section className="wizard platform-card"><h2>Acceso temporal del responsable</h2><p>Vence {activation.expiresAt ? new Date(activation.expiresAt).toLocaleString("es-UY", { timeZone: "America/Montevideo" }) : "en 24 horas"}. Compartilo manualmente por un canal de confianza. Este enlace se muestra ahora y no se guarda en claro.</p><label>Enlace de activación<input readOnly value={activation.activationLink} onFocus={event => event.currentTarget.select()} /></label><button className="secondary" onClick={() => navigator.clipboard.writeText(activation.activationLink!)}>Copiar enlace</button></section>}
    <div className="platform-grid"><section className="wizard platform-card"><h2>Crear negocio</h2><p className="sub">El responsable completará su contraseña mediante un enlace que vence en 24 horas.</p><form onSubmit={event => { event.preventDefault(); void create(); }}>
      <div className="formrow"><label htmlFor="business-name">Nombre visible</label><input id="business-name" required minLength={2} maxLength={100} value={form.businessName} onChange={event => setForm({ ...form, businessName: event.target.value })} /></div>
      <div className="formrow"><label htmlFor="business-slug">Enlace fijo</label><input id="business-slug" required maxLength={63} pattern="[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*" value={form.slug} onChange={event => setForm({ ...form, slug: event.target.value.toLowerCase() })} /><small>Vista previa: {typeof window !== "undefined" ? window.location.origin : ""}/{form.slug || "tu-negocio"}/reservar</small></div>
      <div className="formrow"><label htmlFor="owner-user">Usuario del responsable</label><input id="owner-user" required maxLength={100} autoComplete="off" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} /></div>
      <div className="formrow"><label htmlFor="business-phone">Teléfono público (opcional)</label><input id="business-phone" inputMode="tel" maxLength={32} value={form.publicPhone} onChange={event => setForm({ ...form, publicPhone: event.target.value })} /></div>
      <div className="formrow"><label htmlFor="business-currency">Moneda</label><input id="business-currency" required maxLength={3} pattern="[A-Z]{3}" value={form.currency} onChange={event => setForm({ ...form, currency: event.target.value.toUpperCase() })} /></div>
      <button className="primary">Crear negocio</button></form>
      {pending && <div className="admin-form"><p>Hay un intento de alta que no confirmó su respuesta. Reintentá con la misma solicitud.</p><button className="secondary" onClick={() => { setForm(pending.payload); void create(pending); }}>Restaurar y reintentar</button></div>}
      {activation?.business && <div className="admin-form"><h3>{activation.business.settings?.businessName ?? activation.business.slug}</h3><p>Enlace público: <a href={`/${activation.business.slug}/reservar`}>/{activation.business.slug}/reservar</a></p><p>Panel: <a href={`/${activation.business.slug}/admin`}>/{activation.business.slug}/admin</a></p></div>}
    </section>
    <section className="wizard platform-card"><div className="admin-heading"><h2>Negocios registrados <span className="badge">{total}</span></h2></div><div className="platform-filters"><label>Buscar<input value={q} onChange={event => { setPage(1); setQ(event.target.value); }} placeholder="Nombre o enlace" /></label><label>Estado<select value={status} onChange={event => { setPage(1); setStatus(event.target.value); }}><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></label></div>
      {rows.length === 0 ? <p className="notice">No hay negocios para mostrar.</p> : <div className="platform-list">{rows.map(row => <div className={`platform-row ${detail?.id === row.id ? "selected" : ""}`} key={row.id}><button className="platform-select" onClick={() => loadDetail(row.id).catch(error => setErrorMessage(error.message))}><strong>{row.settings?.businessName ?? row.slug}</strong><span>/{row.slug} · {row.status === "active" ? "Activo" : "Inactivo"}</span></button><div className="platform-row-links"><a href={`/${row.slug}/reservar`}>Reservas</a><a href={`/${row.slug}/admin`}>Panel</a></div></div>)}</div>}
      <div className="actions"><button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span className="notice">Página {page} de {pages}</span><button className="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente</button></div>
    </section></div>
    {detail && <section className="wizard platform-card platform-detail"><div className="admin-heading"><div><div className="eyebrow">Ficha del negocio</div><h2>{detail.settings?.businessName}</h2></div><span className="badge">{detail.status === "active" ? "Activo" : "Inactivo"}</span></div>
      <p>Enlace público: <a href={`/${detail.slug}/reservar`}>/{detail.slug}/reservar</a> <button className="secondary small-button" onClick={() => void copy(`/${detail.slug}/reservar`)}>Copiar</button></p><p>Panel del responsable: <a href={`/${detail.slug}/admin`}>/{detail.slug}/admin</a> <button className="secondary small-button" onClick={() => void copy(`/${detail.slug}/admin`)}>Copiar</button></p>
      <form onSubmit={updateBusiness}><div className="formrow"><label>Nombre visible<input name="businessName" required minLength={2} maxLength={100} defaultValue={detail.settings?.businessName ?? ""} /></label></div><div className="formrow"><label>Teléfono público<input name="publicPhone" maxLength={32} defaultValue={detail.settings?.publicPhone ?? ""} /></label></div><button className="primary">Guardar cambios</button></form>
      <div className="platform-actions"><button className="secondary" onClick={() => void issueActivation()}>Emitir nuevo acceso temporal</button><button className={detail.status === "active" ? "danger-button" : "primary"} onClick={() => void toggleStatus()}>{detail.status === "active" ? "Desactivar negocio" : "Reactivar negocio"}</button></div>
      <h3>Actividad reciente</h3>{detail.audits.length === 0 ? <p className="notice">Todavía no hay acciones registradas.</p> : <ul className="audit-list">{detail.audits.map(entry => <li key={entry.id}><strong>{entry.action}</strong><span>{new Date(entry.createdAt).toLocaleString("es-UY", { timeZone: "America/Montevideo" })}</span>{entry.changesJson && <small>{entry.changesJson}</small>}</li>)}</ul>}
    </section>}
    <footer className="footer">La plataforma administra negocios y acceso de responsables. No muestra datos ni agendas de clientes.</footer>
  </main>;
}
