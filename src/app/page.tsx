import type { Metadata } from "next";
import { BusinessAccess } from "@/components/marketing/business-access";
import { SiteHeader } from "@/components/marketing/site-header";
import { getDemoHref, marketing } from "@/lib/marketing-content";
import styles from "@/components/marketing/landing.module.css";

const description = "Reserva organiza la agenda de peluquerías y barberías con reservas online, horarios y profesionales en un solo lugar.";
const demoHref = getDemoHref();

export const metadata: Metadata = {
  metadataBase: new URL(marketing.canonicalOrigin),
  title: { absolute: "Reserva | Reservas online para peluquerías y barberías" },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_UY",
    siteName: marketing.productName,
    title: "Reserva | Reservas online para peluquerías y barberías",
    description,
    url: "/",
    images: [{ url: "/marketing/og.svg", width: 1200, height: 630, alt: "Reserva, sistema de reservas para peluquerías y barberías" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reserva | Reservas online para peluquerías y barberías",
    description,
    images: ["/marketing/og.svg"],
  },
};

function Arrow() { return <span aria-hidden="true">↗</span>; }

export default function Home() {
  return (
    <main className={styles.page} id="inicio">
      <div className={styles.siteWidth}>
        <SiteHeader />

        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span className={styles.eyebrowDot} /> Reservas simples para negocios reales</p>
            <h1 id="hero-title">Tu agenda ordenada. <span>Tus clientes reservan online.</span></h1>
            <p className={styles.heroText}>{marketing.hero.description}</p>
            <div className={styles.heroActions}>
              <a className={styles.buttonPrimary} href="#contacto">Solicitar una demo <Arrow /></a>
              <a className={styles.buttonQuiet} href="#como-funciona">Ver cómo funciona <span aria-hidden="true">↓</span></a>
            </div>
            <p className={styles.heroNote}><span aria-hidden="true">✓</span> Reservas desde el navegador, sin crear una cuenta.</p>
          </div>

          <div className={styles.productVisual} role="img" aria-label="Ilustración de ejemplo del flujo de reservas y agenda de Reserva">
            <div className={styles.visualGlow} />
            <div className={styles.phone}>
              <div className={styles.phoneTop}><span /><span /><span /></div>
              <div className={styles.phoneContent}>
                <div className={styles.demoShopMark}>CN</div>
                <p className={styles.phoneKicker}>RESERVÁ TU HORA</p>
                <h2>Casa Norte</h2>
                <p className={styles.phoneSub}>Elegí un servicio para empezar</p>
                <div className={styles.servicePreview}><span className={styles.serviceIcon}>✦</span><span><strong>Corte clásico</strong><small>30 min · $ 650</small></span><span className={styles.previewArrow}>›</span></div>
                <div className={styles.servicePreview}><span className={`${styles.serviceIcon} ${styles.serviceIconAlt}`}>✂</span><span><strong>Barba</strong><small>20 min · $ 400</small></span><span className={styles.previewArrow}>›</span></div>
                <p className={styles.phoneKicker}>JUEVES 19 DE NOVIEMBRE</p>
                <div className={styles.timePreview}><b>09:30</b><b>10:00</b><b>10:30</b></div>
                <p className={styles.previewDisclaimer}>Ilustración · datos de ejemplo</p>
              </div>
            </div>
            <div className={styles.agendaCard} aria-label="Vista ilustrativa de la agenda del negocio">
              <div className={styles.agendaHead}><span><small>AGENDA</small><strong>Hoy, jueves 19</strong></span><span className={styles.avatar}>CN</span></div>
              <div className={styles.agendaBar}><span>09:30</span><span className={styles.agendaEvent}><b>Mateo Silva</b><small>Corte clásico · Nico</small></span></div>
              <div className={styles.agendaBar}><span>10:00</span><span className={`${styles.agendaEvent} ${styles.agendaEventGreen}`}><b>Lucía Pérez</b><small>Barba · Nico</small></span></div>
              <div className={styles.agendaBar}><span>10:30</span><span className={styles.agendaOpen}>Hora disponible</span></div>
              <div className={styles.agendaFooter}><span className={styles.liveDot} /> Agenda del negocio</div>
            </div>
            <span className={styles.visualBadge}><span aria-hidden="true">✓</span> Tu agenda, más clara</span>
          </div>
        </section>

        <section className={styles.trustLine} aria-label="Características principales">
          <span><b>01</b> Sin instalar una app</span><i />
          <span><b>02</b> Configurás tu equipo</span><i />
          <span><b>03</b> Vos manejás la agenda</span>
        </section>

        <section className={styles.section} id="funciones" aria-labelledby="features-title">
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>Todo en orden</p>
            <h2 id="features-title">La agenda de tu local, <span>en un solo lugar.</span></h2>
            <p>Definí qué servicios ofrecés, quién los realiza y en qué horarios. Reserva muestra las horas disponibles y reúne las reservas en tu panel.</p>
          </div>
          <div className={styles.featureGrid}>
            {marketing.features.map(([title, text], index) => (
              <article className={styles.featureCard} key={title}>
                <span className={styles.featureNumber}>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.stepsSection} id="como-funciona" aria-labelledby="steps-title">
          <div className={styles.stepsIntro}>
            <p className={styles.eyebrow}>Fácil de poner en marcha</p>
            <h2 id="steps-title">De tu enlace a la agenda, <span>en tres pasos.</span></h2>
            <p>El alta es acompañada por nuestro equipo. Consultanos y coordinamos el alta de tu local.</p>
            <a href="#contacto" className={styles.textLink}>Conocé Reserva <Arrow /></a>
          </div>
          <ol className={styles.stepList}>
            {marketing.steps.map(([title, text], index) => (
              <li className={styles.stepItem} key={title}>
                <span className={styles.stepIndex}>{String(index + 1).padStart(2, "0")}</span>
                <div><h3>{title}</h3><p>{text}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.whatsappSection} aria-labelledby="whatsapp-title">
          <div className={styles.chatVisual} aria-hidden="true">
            <div className={styles.chatWindow}>
              <div className={styles.chatTop}><span className={styles.chatAvatar}>CN</span><span><b>Casa Norte</b><small>WhatsApp Business</small></span><span className={styles.chatDots}>•••</span></div>
              <div className={styles.chatBody}><span className={styles.chatDate}>HOY</span><div className={styles.chatBubble}>¡Hola! Para reservar con Casa Norte, elegí el servicio y el horario acá:<br /><u>reservas.balaxys.com/casa-norte/reservar</u><small>9:41 ✓✓</small></div><div className={styles.chatReply}>¡Gracias! Ya estoy mirando. <small>9:42</small></div></div>
              <div className={styles.chatInput}><span>Mensaje</span><b aria-hidden="true">➤</b></div>
            </div>
          </div>
          <div className={styles.whatsappCopy}>
            <p className={styles.eyebrow}>En tus canales de siempre</p>
            <h2 id="whatsapp-title">Compartí tu enlace donde ya hablás con tus clientes.</h2>
            <p>Podés incluir el enlace de reservas en el saludo de WhatsApp Business App o enviarlo en una conversación. Tu cliente abre la página y elige su turno.</p>
            <p className={styles.whatsappNote}><span aria-hidden="true">i</span> El saludo se configura en WhatsApp Business App. Los avisos y mensajes a clientes se envían manualmente.</p>
          </div>
        </section>

        <section className={styles.faqSection} id="preguntas" aria-labelledby="faq-title">
          <div className={styles.faqIntro}><p className={styles.eyebrow}>Respuestas claras</p><h2 id="faq-title">Preguntas <span>frecuentes.</span></h2><p>Lo que necesitás saber antes de empezar.</p></div>
          <div className={styles.faqList}>
            {marketing.faqs.map(([question, answer]) => <details className={styles.faqItem} key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}
          </div>
        </section>

        <section className={styles.contactSection} id="contacto" aria-labelledby="contact-title">
          <div className={styles.contactOrb} aria-hidden="true">R</div>
          <div className={styles.contactCopy}><p className={styles.eyebrow}>Reserva · Un producto de Balaxys</p><h2 id="contact-title">Dale a tu negocio una forma simple de recibir reservas.</h2><p>Conocé Reserva y veamos cómo organizar la agenda de tu local.</p></div>
          {demoHref && <a className={styles.buttonLight} href={demoHref} target={demoHref.startsWith("https:") ? "_blank" : undefined} rel={demoHref.startsWith("https:") ? "noreferrer" : undefined}>Solicitar una demo <Arrow /></a>}
        </section>

        <section className={styles.accessSection} id="acceso" aria-labelledby="access-title">
          <div><p className={styles.eyebrow}>Para clientes actuales</p><h2 id="access-title">¿Ya usás Reserva?</h2><p>Abrí el enlace de administración que recibiste al activar tu negocio.</p></div>
          <BusinessAccess />
        </section>

        <footer className={styles.footer}>
          <a className={styles.wordmark} href="#inicio"><span className={styles.brandMark} aria-hidden="true">R</span><span>Reserva<span className={styles.brandDot}>.</span></span></a>
          <span>Un producto de {marketing.providerName}</span>
          {demoHref && <a href={demoHref} target="_blank" rel="noreferrer">WhatsApp comercial</a>}
          <span>© {new Date().getFullYear()} Reserva</span>
        </footer>
      </div>
    </main>
  );
}
