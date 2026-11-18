/* eslint-disable @next/next/no-img-element -- Blob URLs are served directly to avoid running images through the app runtime. */
"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { optimizeServiceImage } from "@/lib/service-image-client";

type Service = { id: string; name: string; description: string | null; durationMinutes: number; priceCents: number | null; imageUrl: string | null; active: boolean };
type Staff = { id: string; name: string; active: boolean; services?: { service: Service }[] };
type Form = { name: string; description: string; durationMinutes: number; price: string };
const emptyForm: Form = { name: "", description: "", durationMinutes: 30, price: "" };

function formatMoney(cents: number, currency: string) {
  try { return new Intl.NumberFormat("es-UY", { style: "currency", currency }).format(cents / 100); }
  catch { return `${currency} ${(cents / 100).toFixed(2)}`; }
}

export default function ServicesPanel({ apiBase }: { apiBase: string }) {
  const payload = useCallback(async (url: string, init?: RequestInit) => {
    const path = url.startsWith("/api/") ? url.slice(4) : url;
    const response = await fetch(`${apiBase}${path}`, { cache: "no-store", ...init });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "No pudimos completar la acción.");
    return data;
  }, [apiBase]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [currency, setCurrency] = useState("UYU");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [newImage, setNewImage] = useState<File | null>(null);
  const [person, setPerson] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editForm, setEditForm] = useState<Form>(emptyForm);
  const [removeImageId, setRemoveImageId] = useState("");
  const [editingStaff, setEditingStaff] = useState("");
  const [staffEditForm, setStaffEditForm] = useState<{ name: string; serviceIds: string[] }>({ name: "", serviceIds: [] });

  const reload = useCallback(() => {
    payload("/api/admin/services").then(data => setServices(data.services)).catch(reason => setError(reason.message));
    payload("/api/admin/staff").then(data => setStaff(data.staff)).catch(reason => setError(reason.message));
    payload("/api/admin/settings").then(data => setCurrency(data.settings.currency)).catch(reason => setError(reason.message));
  }, [payload]);
  useEffect(() => { reload(); }, [reload]);

  async function uploadImage(serviceId: string, file: File) {
    const optimized = await optimizeServiceImage(file);
    const intent = await payload("/api/admin/service-images", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId }),
    });
    const uploaded = await fetch(intent.uploadUrl, {
      method: "PUT", headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": "image/webp" }, body: optimized,
    });
    if (!uploaded.ok) throw new Error("No pudimos subir la imagen. Revisá la configuración CORS de Azure Blob Storage.");
    await payload("/api/admin/service-images", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, blobName: intent.blobName }),
    });
  }

  async function addService(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await payload("/api/admin/services", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, description: form.description || null, durationMinutes: Number(form.durationMinutes), priceCents: form.price ? Math.round(Number(form.price) * 100) : null }),
      });
      setForm(emptyForm);
      if (newImage) await uploadImage(created.id, newImage);
      setNewImage(null); setError(""); reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el servicio."); reload();
    } finally { setSaving(false); }
  }

  async function saveService(event: React.FormEvent, serviceId: string) {
    event.preventDefault();
    setSaving(true);
    try {
      await payload("/api/admin/services", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: serviceId, name: editForm.name, description: editForm.description || null, durationMinutes: Number(editForm.durationMinutes), priceCents: editForm.price ? Math.round(Number(editForm.price) * 100) : null }),
      });
      if (editImage) await uploadImage(serviceId, editImage);
      setEditImage(null); setEditing(""); setError(""); reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar el servicio."); reload();
    } finally { setSaving(false); }
  }

  async function removeImage() {
    if (!removeImageId) return;
    try {
      await payload("/api/admin/service-images", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId: removeImageId }) });
      setError(""); reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo eliminar la imagen."); }
    finally { setRemoveImageId(""); }
  }

  async function toggleService(service: Service) {
    try {
      await payload("/api/admin/services", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: service.id, active: !service.active }) });
      reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar el servicio."); }
  }

  async function addStaff(event: React.FormEvent) {
    event.preventDefault();
    try {
      await payload("/api/admin/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: person, serviceIds: selected }) });
      setPerson(""); setSelected([]); reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); }
  }

  async function toggleStaff(member: Staff) {
    try {
      await payload("/api/admin/staff", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: member.id, active: !member.active }) });
      reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar el profesional."); }
  }

  function startStaffEdit(member: Staff) {
    setError("");
    setEditingStaff(current => current === member.id ? "" : member.id);
    setStaffEditForm({ name: member.name, serviceIds: member.services?.map(item => item.service.id) ?? [] });
  }

  async function saveStaff(event: React.FormEvent, member: Staff) {
    event.preventDefault();
    if (!staffEditForm.serviceIds.length) {
      setError("Seleccioná al menos un servicio para el profesional.");
      return;
    }
    setSaving(true);
    try {
      await payload("/api/admin/staff", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, name: staffEditForm.name, serviceIds: staffEditForm.serviceIds }),
      });
      setEditingStaff(""); setError(""); reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar el profesional."); }
    finally { setSaving(false); }
  }

  const imageInput = (label: string, onChange: (file: File | null) => void) => <label>{label}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => onChange(event.target.files?.[0] ?? null)} /></label>;

  return <div>
    <h2>Servicios y equipo</h2>
    <p className="sub">Definí los servicios, su duración y quién los realiza.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="admin-columns">
      <form className="admin-form" onSubmit={addService}>
        <h3>Agregar servicio</h3>
        <label>Nombre<input required minLength={2} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
        <label>Descripción<input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
        <div className="formgrid">
          <label>Duración (minutos)<input type="number" min="5" max="480" step="5" value={form.durationMinutes} onChange={event => setForm({ ...form, durationMinutes: Number(event.target.value) })} /></label>
          <label>Precio informativo<input type="number" min="0" step="1" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} /></label>
        </div>
        {imageInput("Imagen del servicio (opcional)", setNewImage)}
        <p className="notice">JPG, PNG o WebP. Se optimiza automáticamente; máximo 500 KB y 1440 px por lado.</p>
        <button className="primary" disabled={saving}>{saving ? "Optimizando y guardando…" : "Guardar servicio"}</button>
      </form>
      <div>
        <h3>Servicios publicados</h3>
        {services.map(service => <article className="summary service-admin-card" key={service.id}>
          {service.imageUrl && <img className="service-admin-thumbnail" src={service.imageUrl} alt={`Imagen de ${service.name}`} loading="lazy" />}
          <div className="item-row"><div><strong>{service.name}</strong><br /><span className="notice">{service.durationMinutes} min{service.priceCents !== null ? ` · ${formatMoney(service.priceCents, currency)}` : ""} · {service.active ? "Activo" : "Inactivo"}</span></div><div>
            <button className="secondary" onClick={() => { setEditForm({ name: service.name, description: service.description ?? "", durationMinutes: service.durationMinutes, price: service.priceCents === null ? "" : String(service.priceCents / 100) }); setEditImage(null); setEditing(editing === service.id ? "" : service.id); }}>Editar</button>{" "}
            <button className="secondary" onClick={() => toggleService(service)}>{service.active ? "Pausar" : "Activar"}</button>
          </div></div>
          {service.imageUrl && <button type="button" className="secondary" onClick={() => setRemoveImageId(service.id)}>Quitar imagen</button>}
          {editing === service.id && <form className="admin-form" onSubmit={event => saveService(event, service.id)}>
            <h3>Editar servicio</h3>
            <label>Nombre<input required minLength={2} value={editForm.name} onChange={event => setEditForm({ ...editForm, name: event.target.value })} /></label>
            <label>Descripción<input value={editForm.description} onChange={event => setEditForm({ ...editForm, description: event.target.value })} /></label>
            <div className="formgrid">
              <label>Duración (minutos)<input type="number" min="5" max="480" step="5" value={editForm.durationMinutes} onChange={event => setEditForm({ ...editForm, durationMinutes: Number(event.target.value) })} /></label>
              <label>Precio<input type="number" min="0" step="1" value={editForm.price} onChange={event => setEditForm({ ...editForm, price: event.target.value })} /></label>
            </div>
            {imageInput("Reemplazar imagen (opcional)", setEditImage)}
            <p className="notice">Al guardar, la imagen nueva reemplaza la actual.</p>
            <button className="primary" disabled={saving}>{saving ? "Optimizando y guardando…" : "Guardar cambios"}</button>
          </form>}
        </article>)}
      </div>
    </div>
    <form className="admin-form" onSubmit={addStaff} style={{ marginTop: 20 }}><h3>Agregar profesional</h3><label>Nombre<input required value={person} onChange={event => setPerson(event.target.value)} /></label><p className="notice">Servicios que realiza</p>{services.filter(service => service.active).map(service => <label key={service.id} className="checkrow"><input type="checkbox" checked={selected.includes(service.id)} onChange={event => setSelected(event.target.checked ? [...selected, service.id] : selected.filter(id => id !== service.id))} />{service.name}</label>)}<button className="primary" disabled={!selected.length}>Agregar al equipo</button></form>
    <h3>Equipo</h3>{staff.map(member => <div className="summary staff-item-row" key={member.id}>
      <div className="item-row"><div><strong>{member.name}</strong><br /><span className="notice">{member.services?.map(item => item.service.name).join(", ")} · {member.active ? "Activo" : "Inactivo"}</span></div><div className="staff-actions"><button type="button" className="secondary" onClick={() => startStaffEdit(member)}>{editingStaff === member.id ? "Cerrar edición" : "Editar"}</button><button type="button" className="secondary" onClick={() => toggleStaff(member)}>{member.active ? "Pausar" : "Activar"}</button></div></div>
      {editingStaff === member.id && <form className="admin-form" onSubmit={event => saveStaff(event, member)}>
        <h3>Editar profesional</h3>
        <label>Nombre del profesional<input required minLength={2} maxLength={80} value={staffEditForm.name} onChange={event => setStaffEditForm(current => ({ ...current, name: event.target.value }))} /></label>
        <p className="notice">Servicios que realiza</p>
        {services.map(service => <label key={service.id} className="checkrow"><input type="checkbox" checked={staffEditForm.serviceIds.includes(service.id)} onChange={event => setStaffEditForm(current => ({ ...current, serviceIds: event.target.checked ? [...current.serviceIds, service.id] : current.serviceIds.filter(id => id !== service.id) }))} />{service.name}{service.active ? "" : " (inactivo)"}</label>)}
        <button className="primary" disabled={saving || !staffEditForm.serviceIds.length}>{saving ? "Guardando…" : "Guardar profesional"}</button>
      </form>}
    </div>)}
    <ConfirmDialog open={Boolean(removeImageId)} title="Quitar imagen del servicio" description="¿Querés quitar esta imagen? La imagen dejará de mostrarse en las reservas." confirmLabel="Quitar imagen" danger onConfirm={removeImage} onClose={() => setRemoveImageId("")} />
  </div>;
}
