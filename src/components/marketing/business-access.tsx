"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./landing.module.css";

export function BusinessAccess() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");

  function openPanel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 63) {
      setError("Ingresá el identificador del negocio, por ejemplo peluqueria-ana.");
      return;
    }
    router.push(`/${value}/admin`);
  }

  return (
    <form className={styles.accessForm} onSubmit={openPanel}>
      <label htmlFor="business-slug">Identificador del negocio</label>
      <div className={styles.accessControls}>
        <input
          id="business-slug"
          name="slug"
          autoComplete="off"
          maxLength={63}
          pattern="[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*"
          placeholder="peluqueria-ana"
          value={slug}
          onChange={event => { setSlug(event.target.value); setError(""); }}
          aria-describedby={error ? "business-slug-error" : "business-slug-hint"}
          required
        />
        <button className={styles.buttonDark} type="submit">Ir a mi panel <span aria-hidden="true">↗</span></button>
      </div>
      {error ? <p id="business-slug-error" className={styles.accessError} role="alert">{error}</p> : <p id="business-slug-hint" className={styles.accessHint}>Solo letras, números y guiones entre palabras.</p>}
    </form>
  );
}
