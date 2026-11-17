"use client";

import { useState } from "react";
import styles from "./landing.module.css";

const links = [
  ["Cómo funciona", "#como-funciona"],
  ["Funciones", "#funciones"],
  ["Preguntas frecuentes", "#preguntas"],
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className={styles.header}>
      <a className={styles.wordmark} href="#inicio" onClick={close} aria-label="Reserva, inicio">
        <span className={styles.brandMark} aria-hidden="true">R</span>
        <span>Reserva<span className={styles.brandDot}>.</span></span>
      </a>
      <button className={styles.menuToggle} type="button" aria-expanded={open} aria-controls="marketing-nav" onClick={() => setOpen(value => !value)}>
        <span className={styles.srOnly}>{open ? "Cerrar menú" : "Abrir menú"}</span>
        <span aria-hidden="true">{open ? "×" : "☰"}</span>
      </button>
      <nav id="marketing-nav" className={`${styles.nav} ${open ? styles.navOpen : ""}`} aria-label="Navegación principal">
        {links.map(([label, href]) => <a key={href} href={href} onClick={close}>{label}</a>)}
        <a className={styles.navAccess} href="#acceso" onClick={close}>Ingresar a mi negocio</a>
        <a className={styles.navCta} href="#contacto" onClick={close}>Solicitar una demo</a>
      </nav>
    </header>
  );
}
