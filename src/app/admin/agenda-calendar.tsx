"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { localToUtc } from "@/lib/time";

type Service = { id: string; name: string; durationMinutes: number; active: boolean };
type Staff = { id: string; name: string; active: boolean };
type Booking = {
  id: string;
  code: string;
  customerName: string;
  phoneNormalized: string;
  startsAt: string;
  endsAt: string;
  status: string;
  service: { name: string; durationMinutes: number };
  staff: { id: string; name: string };
};

const ZONE = "America/Montevideo";
const addDays = (value: string, count: number) => {
  const day = new Date(`${value}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + count);
  return day.toISOString().slice(0, 10);
};
const localInstant = (value: string, time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return localToUtc(value, hour * 60 + minute).toISOString();
};
const localFields = (value: string) => {
  const fields = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value)).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return { date: `${fields.year}-${fields.month}-${fields.day}`, time: `${fields.hour}:${fields.minute}` };
};

export default function AgendaCalendar({ apiBase }: { apiBase: string }) {
  const payload = useCallback(async (url: string, init?: RequestInit) => {
    const path = url.startsWith("/api/") ? url.slice(4) : url;
    const response = await fetch(`${apiBase}${path}`, { cache: "no-store", ...init });
    const result = await response.json();
    if (!response.ok) throw Error(result.error ?? "No se pudo completar la accion.");
    return result;
  }, [apiBase]);
  const [date, setDate] = useState("");
  const [mode, setMode] = useState<"day" | "week">("day");
  const [items, setItems] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [confirmBooking, setConfirmBooking] = useState<Booking | null>(null);
  const [manual, setManual] = useState(false);
  const [editing, setEditing] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editForm, setEditForm] = useState({ date: "", time: "", staffId: "" });
  const [form, setForm] = useState({ serviceId: "", staffId: "", date: "", time: "09:00", name: "", phone: "" });

  useEffect(() => {
    const timer = window.setTimeout(() => setDate(new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date())), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    payload("/api/admin/services").then(result => setServices(result.services));
    payload("/api/admin/staff").then(result => setStaff(result.staff)).catch(() => {});
  }, [payload]);

  const weekStart = date ? addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7)) : "";
  const weekDays = weekStart ? Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)) : [];
  useEffect(() => {
    if (!date) return;
    let active = true;
    const start = mode === "week" ? weekStart : date;
    const end = addDays(start, mode === "week" ? 7 : 1);
    payload(`/api/admin/bookings?from=${encodeURIComponent(localInstant(start, "00:00"))}&to=${encodeURIComponent(localInstant(end, "00:00"))}`)
      .then(result => {
        if (!active) return;
        setItems(result.bookings);
        setSelectedId(current => result.bookings.some((booking: Booking) => booking.id === current) ? current : (result.bookings[0]?.id ?? ""));
        setError("");
      })
      .catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [date, mode, refresh, payload, weekStart]);

  async function update(booking: Booking, status: string) {
    if (status === "cancelled") { setConfirmBooking(booking); return; }
    await applyUpdate(booking, status);
  }
  async function applyUpdate(booking: Booking, status: string) {
    try {
      await payload("/api/admin/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: booking.id, status }) });
      setConfirmBooking(null); setError(""); setRefresh(value => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar."); setConfirmBooking(null); setRefresh(value => value + 1);
    }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await payload("/api/admin/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, startsAt: localInstant(form.date, form.time) }) });
      setDate(form.date); setItems(current => [...current.filter(item => item.id !== result.booking.id), result.booking]);
      setSelectedId(result.booking.id); setManual(false); setRefresh(value => value + 1); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo crear."); }
  }
  async function saveMove(event: React.FormEvent, booking: Booking) {
    event.preventDefault();
    try {
      await payload("/api/admin/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: booking.id, startsAt: localInstant(editForm.date, editForm.time), staffId: editForm.staffId }) });
      setEditing(""); setRefresh(value => value + 1); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cambiar."); }
  }

  const move = (step: number) => setDate(value => value ? addDays(value, step * (mode === "week" ? 7 : 1)) : value);
  const dateLabel = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-UY", { ...options, timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
  const statusLabels: Record<string, string> = { confirmed: "Confirmada", cancelled: "Cancelada", completed: "Completada", no_show: "No asistió" };
  const term = search.trim().toLocaleLowerCase("es-UY");
  const visibleItems = items.filter(booking =>
    (staffFilter === "all" || booking.staff.id === staffFilter)
    && (statusFilter === "all" || booking.status === statusFilter)
    && (!term || `${booking.customerName} ${booking.service.name} ${booking.staff.name} ${booking.code}`.toLocaleLowerCase("es-UY").includes(term)),
  ).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const dayItems = visibleItems.filter(booking => localFields(booking.startsAt).date === date);
  const selectedBooking = items.find(booking => booking.id === selectedId) ?? null;
  const visibleDays = mode === "day" ? [date] : weekDays;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const openDay = (value: string) => { setDate(value); setMode("day"); };

  return <div className="agenda-shell">
    <header className="agenda-header">
      <div><p className="agenda-kicker">GESTIÓN DEL LOCAL</p><h2>Agenda</h2><p className="sub">Montevideo · {date ? dateLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "cargando fecha"}</p></div>
      <div className="agenda-summary" aria-live="polite"><strong>{visibleItems.length}</strong><span>{visibleItems.length === 1 ? "reserva" : "reservas"} en {mode === "day" ? "el día" : "la semana"}</span><button className="agenda-today" onClick={() => setDate(today)}>Hoy</button></div>
    </header>
    <div className="agenda-controls" aria-label="Navegación del calendario">
      <button className="secondary" aria-label="Anterior" onClick={() => move(-1)}>←</button>
      <input type="date" aria-label="Fecha de agenda" value={date} onChange={event => setDate(event.target.value)} />
      <button className="secondary" aria-label="Siguiente" onClick={() => move(1)}>→</button>
      <button className="secondary agenda-week-toggle" onClick={() => setMode(mode === "day" ? "week" : "day")}>{mode === "day" ? "Ver semana" : "Ver día"}</button>
    </div>
    <nav className="agenda-week-strip" aria-label="Días de la semana">
      {weekDays.map(day => {
        const count = items.filter(booking => localFields(booking.startsAt).date === day).length;
        const selected = day === date;
        return <button type="button" key={day} className={`agenda-day-chip${selected ? " is-selected" : ""}${day === today ? " is-today" : ""}`} aria-pressed={selected} onClick={() => openDay(day)}>
          <span>{dateLabel(day, { weekday: "short" }).replace(".", "")}</span><strong>{dateLabel(day, { day: "numeric" })}</strong><i aria-label={`${count} reservas`} className={count ? "has-bookings" : ""} />
        </button>;
      })}
    </nav>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="agenda-toolbar" aria-label="Buscar y filtrar reservas">
      <label className="agenda-search"><span className="sr-only">Buscar por cliente, servicio o código</span><span aria-hidden="true">⌕</span><input type="search" placeholder="Buscar cliente o servicio" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label><span className="sr-only">Filtrar por profesional</span><select aria-label="Filtrar por profesional" value={staffFilter} onChange={event => setStaffFilter(event.target.value)}><option value="all">Todos los profesionales</option>{staff.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <label><span className="sr-only">Filtrar por estado</span><select aria-label="Filtrar por estado" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Todos los estados</option><option value="confirmed">Confirmadas</option><option value="completed">Completadas</option><option value="no_show">No asistió</option><option value="cancelled">Canceladas</option></select></label>
      {(search || staffFilter !== "all" || statusFilter !== "all") && <button className="agenda-clear" onClick={() => { setSearch(""); setStaffFilter("all"); setStatusFilter("all"); }}>Limpiar filtros</button>}
    </section>
    <div className="agenda-section-heading"><div><h3>{mode === "day" ? "Reservas del día" : "Semana"}</h3><p>{mode === "day" ? `${dayItems.length} ${dayItems.length === 1 ? "turno" : "turnos"}` : "Seleccioná un día para ver su agenda"}</p></div><button className="primary agenda-manual" onClick={() => { setForm({ ...form, date: date || "" }); setManual(value => !value); }}>{manual ? "Cerrar" : "+ Reserva manual"}</button></div>
    {manual && <form className="admin-form" onSubmit={create}><h3>Nueva reserva</h3><div className="formgrid"><label>Servicio<select required value={form.serviceId} onChange={event => setForm({ ...form, serviceId: event.target.value })}><option value="">Elegí</option>{services.filter(service => service.active).map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><label>Profesional<select required value={form.staffId} onChange={event => setForm({ ...form, staffId: event.target.value })}><option value="">Elegí</option>{staff.filter(person => person.active).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Día<input type="date" required value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></label><label>Hora<input type="time" required value={form.time} onChange={event => setForm({ ...form, time: event.target.value })} /></label><label>Nombre<input required minLength={2} maxLength={80} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>Teléfono<input required inputMode="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label></div><div className="actions"><button type="button" className="secondary" onClick={() => setManual(false)}>Cerrar</button><button className="primary">Guardar reserva</button></div></form>}
    <div className="agenda-layout">
      <section className="agenda-timeline" aria-label="Reservas">
        {visibleDays.map(day => {
          const bookings = visibleItems.filter(booking => localFields(booking.startsAt).date === day);
          if (mode === "week" && bookings.length === 0) return <button type="button" key={day} className="agenda-empty-day" onClick={() => openDay(day)}><span>{dateLabel(day, { weekday: "long", day: "numeric", month: "short" })}</span><span>Sin reservas · Ver día →</span></button>;
          return <section className="agenda-day-group" key={day}>
            {mode === "week" && <button className="agenda-group-title" onClick={() => openDay(day)}><strong>{dateLabel(day, { weekday: "long", day: "numeric", month: "long" })}</strong><span>{bookings.length} reservas · Ver día →</span></button>}
            {bookings.length === 0 ? <div className="agenda-empty"><span className="agenda-empty-icon">◷</span><strong>{items.length === 0 ? "Todavía no hay reservas" : "No hay reservas con estos filtros"}</strong><span>{items.length === 0 ? "Cuando alguien reserve, vas a verlo en esta agenda." : "Probá cambiar la búsqueda o los filtros."}</span>{items.length > 0 && <button className="secondary" onClick={() => { setSearch(""); setStaffFilter("all"); setStatusFilter("all"); }}>Quitar filtros</button>}</div> : bookings.map(booking => {
              const time = localFields(booking.startsAt).time;
              const selected = booking.id === selectedId;
              return <button type="button" className={`agenda-event status-border-${booking.status}${selected ? " is-active" : ""}`} key={booking.id} aria-pressed={selected} onClick={() => { setSelectedId(booking.id); setEditing(""); }}>
                <span className="agenda-event-time">{time}</span><span className="agenda-event-content"><strong>{booking.service.name}<small>{booking.service.durationMinutes} min</small></strong><span>{booking.customerName}{booking.phoneNormalized ? ` · ${booking.phoneNormalized}` : ""}</span><span className="agenda-event-staff">Con {booking.staff.name}</span></span><span className={`status status-${booking.status}`}>{statusLabels[booking.status] ?? booking.status}</span><span aria-hidden="true" className="agenda-event-chevron">›</span>
              </button>;
            })}
          </section>;
        })}
      </section>
      {selectedBooking && <aside className="agenda-detail" aria-label="Detalle de reserva"><div className="agenda-detail-head"><div><p className="agenda-kicker">RESERVA SELECCIONADA</p><h3>{selectedBooking.customerName}</h3></div><span className={`status status-${selectedBooking.status}`}>{statusLabels[selectedBooking.status] ?? selectedBooking.status}</span></div><p className="agenda-detail-service"><strong>{selectedBooking.service.name}</strong><span>{selectedBooking.service.durationMinutes} min · {dateLabel(localFields(selectedBooking.startsAt).date, { day: "numeric", month: "short" })} · {localFields(selectedBooking.startsAt).time}</span></p><p className="agenda-detail-staff">Con {selectedBooking.staff.name}{selectedBooking.phoneNormalized ? ` · ${selectedBooking.phoneNormalized}` : ""}</p><p className="agenda-detail-code">Código <strong>{selectedBooking.code}</strong></p>
        {selectedBooking.status === "confirmed" && <div className="booking-actions"><button className="secondary" onClick={() => update(selectedBooking, "completed")}>Completar</button><button className="secondary" onClick={() => update(selectedBooking, "no_show")}>No asistió</button><button className="secondary" onClick={() => update(selectedBooking, "cancelled")}>Cancelar</button><button className="secondary" onClick={() => { const fields = localFields(selectedBooking.startsAt); setEditForm({ date: fields.date, time: fields.time, staffId: selectedBooking.staff.id }); setEditing(editing === selectedBooking.id ? "" : selectedBooking.id); }}>Mover / reasignar</button></div>}
        {editing === selectedBooking.id && <form className="admin-form" onSubmit={event => saveMove(event, selectedBooking)}><div className="formgrid"><label>Día<input type="date" required value={editForm.date} onChange={event => setEditForm({ ...editForm, date: event.target.value })} /></label><label>Hora<input type="time" required value={editForm.time} onChange={event => setEditForm({ ...editForm, time: event.target.value })} /></label><label>Profesional<select required value={editForm.staffId} onChange={event => setEditForm({ ...editForm, staffId: event.target.value })}>{staff.filter(person => person.active).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div><button className="primary">Guardar cambio</button></form>}
      </aside>}
    </div>
    <ConfirmDialog open={Boolean(confirmBooking)} title="Cancelar reserva" description={confirmBooking ? `¿Querés cancelar la reserva de ${confirmBooking.customerName}?` : "¿Querés cancelar esta reserva?"} confirmLabel="Cancelar turno" danger onConfirm={() => confirmBooking ? applyUpdate(confirmBooking, "cancelled") : undefined} onClose={() => setConfirmBooking(null)} />
  </div>;
}
