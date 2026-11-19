"use client";

import { useCallback, useEffect, useState } from "react";

type Report = {
  total: number;
  statuses: { confirmed: number; completed: number; cancelled: number; no_show: number };
  weekdays: { day: number; label: string; count: number }[];
  busiestHours: { hour: number; count: number }[];
  services: { id: string; name: string; count: number }[];
  staff: { id: string; name: string; count: number; reservedMinutes: number }[];
};

function todayInMontevideo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatPeriodDate(value: string) {
  return new Intl.DateTimeFormat("es-UY", {
    timeZone: "UTC", day: "numeric", month: "short",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!hours) return `${remaining} min`;
  return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
}

export default function ReportsPanel({ apiBase }: { apiBase: string }) {
  const payload = useCallback(async (url: string) => {
    const path = url.startsWith("/api/") ? url.slice(4) : url;
    const response = await fetch(`${apiBase}${path}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw Error(body.error ?? "No pudimos cargar los informes.");
    return body;
  }, [apiBase]);
  const [range, setRange] = useState({ from: "", to: "" });
  const [draft, setDraft] = useState({ from: "", to: "" });
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const to = todayInMontevideo();
      const from = shiftDate(to, -29);
      setRange({ from, to });
      setDraft({ from, to });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!range.from || !range.to) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      payload(`/api/admin/reports?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`)
        .then(result => { if (active) setReport(result.report); })
        .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "No pudimos cargar los informes."); })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [payload, range]);

  function choosePreset(days: 7 | 30) {
    const to = todayInMontevideo();
    const next = { from: shiftDate(to, -(days - 1)), to };
    setDraft(next);
    setRange(next);
  }

  function applyCustomRange(event: React.FormEvent) {
    event.preventDefault();
    if (draft.from && draft.to) setRange(draft);
  }

  const maxWeekday = Math.max(1, ...(report?.weekdays.map(item => item.count) ?? []));
  const maxService = Math.max(1, ...(report?.services.map(item => item.count) ?? []));
  const statusCards = report ? [
    { label: "Reservas", value: report.total, className: "report-kpi-total" },
    { label: "Confirmadas", value: report.statuses.confirmed, className: "report-kpi-confirmed" },
    { label: "Completadas", value: report.statuses.completed, className: "report-kpi-completed" },
    { label: "Canceladas", value: report.statuses.cancelled, className: "report-kpi-cancelled" },
    { label: "No asistió", value: report.statuses.no_show, className: "report-kpi-no-show" },
  ] : [];

  return <section className="reports-panel" aria-labelledby="reports-title">
    <header className="reports-header"><div><p className="agenda-kicker">RESUMEN DEL NEGOCIO</p><h2 id="reports-title">Informes</h2><p className="sub">Reservas programadas para el período elegido.</p></div>
      {range.from && range.to && <p className="reports-current-period">{formatPeriodDate(range.from)} – {formatPeriodDate(range.to)}</p>}
    </header>

    <div className="reports-range" aria-label="Período del informe">
      <button type="button" className="secondary" onClick={() => choosePreset(7)}>7 días</button>
      <button type="button" className="secondary" onClick={() => choosePreset(30)}>30 días</button>
      <form className="reports-custom-range" onSubmit={applyCustomRange}>
        <label><span>Desde</span><input aria-label="Desde" type="date" value={draft.from} max={draft.to || undefined} onChange={event => setDraft(current => ({ ...current, from: event.target.value }))} required /></label>
        <label><span>Hasta</span><input aria-label="Hasta" type="date" value={draft.to} min={draft.from || undefined} onChange={event => setDraft(current => ({ ...current, to: event.target.value }))} required /></label>
        <button className="primary" disabled={!draft.from || !draft.to || draft.to < draft.from}>Aplicar</button>
      </form>
    </div>

    {error && <p className="error" role="alert">{error}</p>}
    {loading && <p className="reports-loading" role="status">Actualizando informes…</p>}

    {report && <>
      <section className="report-kpis" aria-label="Reservas por estado">
        {statusCards.map(card => <article className={`report-kpi ${card.className}`} key={card.label}><span>{card.label}</span><strong>{card.value}</strong></article>)}
      </section>

      {report.total === 0 ? <div className="reports-empty"><strong>No hay reservas en este período</strong><span>Probá con otro rango de fechas. Las próximas reservas aparecerán aquí.</span></div> : <div className="reports-grid">
        <section className="report-card report-weekdays"><div className="report-card-heading"><div><h3>Demanda por día</h3><p>Reservas según el día de la semana</p></div></div>
          <div className="report-bars" role="img" aria-label="Reservas agrupadas por día de la semana">{report.weekdays.map(item => <div className="report-bar-column" key={item.day} aria-label={`${item.label}: ${item.count} reservas`}><strong>{item.count || ""}</strong><div className="report-bar-track"><i style={{ height: `${item.count ? Math.max(5, item.count / maxWeekday * 100) : 0}%` }} /></div><span>{item.label.slice(0, 3)}</span></div>)}</div>
        </section>

        <section className="report-card"><div className="report-card-heading"><div><h3>Horarios con más reservas</h3><p>Horas locales de Montevideo</p></div></div>
          {report.busiestHours.length ? <ol className="report-hour-list">{report.busiestHours.map(item => <li key={item.hour}><time>{String(item.hour).padStart(2, "0")}:00</time><span className="report-inline-track"><i style={{ width: `${item.count / report.busiestHours[0].count * 100}%` }} /></span><strong>{item.count}</strong></li>)}</ol> : <p className="notice">Sin datos para este período.</p>}
        </section>

        <section className="report-card"><div className="report-card-heading"><div><h3>Servicios más reservados</h3><p>Reservas que comienzan en el período</p></div></div>
          <ol className="report-ranking">{report.services.map((item, index) => <li key={item.id}><span className="report-rank">{index + 1}</span><div className="report-rank-content"><div><strong>{item.name}</strong><span>{item.count} {item.count === 1 ? "reserva" : "reservas"}</span></div><div className="report-rank-track"><i style={{ width: `${item.count / maxService * 100}%` }} /></div></div></li>)}</ol>
        </section>

        <section className="report-card"><div className="report-card-heading"><div><h3>Actividad por profesional</h3><p>Turnos no cancelados y tiempo asignado</p></div></div>
          <ol className="report-staff-list">{report.staff.map(item => <li key={item.id}><div><strong>{item.name}</strong><span>{formatDuration(item.reservedMinutes)} asignados</span></div><strong className="report-staff-count">{item.count} {item.count === 1 ? "turno" : "turnos"}</strong></li>)}</ol>
        </section>
      </div>}
      <p className="reports-footnote">Los informes cuentan reservas por fecha del turno y muestran su estado actual. No representan ventas ni ingresos.</p>
    </>}
  </section>;
}
