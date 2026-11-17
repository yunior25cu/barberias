export const marketing = {
  productName: "Reserva",
  providerName: "Balaxys",
  canonicalOrigin: "https://reservas.balaxys.com",
  reservationPath: "/al-corte/reservar",
  contact: { kind: "whatsapp", value: "+598 94448249" } as { kind: "whatsapp"; value: string } | { kind: "email"; value: string } | null,
  hero: {
    title: "Tu agenda ordenada. Tus clientes reservan online.",
    description: "Reserva es el sistema de reservas para peluquerías y barberías. Compartí el enlace de tu negocio y dejá que tus clientes elijan servicio, día y hora desde el celular.",
  },
  features: [
    ["Un enlace para tu negocio.", "Compartilo por WhatsApp, en Instagram o con tus clientes habituales."],
    ["Reservas desde el celular.", "Tus clientes eligen servicio, día y hora sin instalar una aplicación."],
    ["Agenda por día y semana.", "Consultá tus turnos y agregá también las reservas que recibís personalmente."],
    ["Servicios y profesionales.", "Configurá la duración de cada servicio y quién puede realizarlo."],
    ["Horarios bajo control.", "Definí jornadas, pausas y bloqueos para ofrecer disponibilidad real."],
    ["Cambios desde tu panel.", "Mové, reasigná o cancelá turnos cuando lo necesites."],
  ],
  steps: [
    ["Configurá tu negocio.", "Te damos acceso para cargar tus servicios, profesionales y horarios."],
    ["Compartí tu enlace.", "Usalo en tus redes y en el saludo de WhatsApp Business App."],
    ["Recibí las reservas.", "Tus clientes eligen una hora disponible y vos la ves en tu agenda."],
  ],
  faqs: [
    ["¿Mis clientes necesitan instalar una aplicación?", "Pueden reservar directamente desde el navegador de su celular, sin instalar nada ni crear una cuenta."],
    ["¿Puedo cargar los turnos que recibo por teléfono o en el local?", "Sí. Podés agregar reservas manualmente desde el panel de tu negocio."],
    ["¿Puedo trabajar con varios profesionales?", "Sí. Configurás los servicios y horarios de cada profesional. El cliente puede elegir con quién reservar o una opción disponible, según la configuración del servicio."],
    ["¿Puedo cambiar un turno o bloquear una hora?", "Sí. Desde tu panel podés mover o cancelar turnos y bloquear horarios. Si necesitás avisarle al cliente, lo hacés manualmente."],
    ["¿Reserva envía mensajes automáticos por WhatsApp?", "Los mensajes a clientes se envían manualmente. Podés configurar WhatsApp Business App para compartir tu enlace en el saludo."],
    ["¿Cuánto cuesta y cómo empiezo?", "Solicitá una demo para conocer las condiciones y coordinar el alta de tu negocio."],
  ],
} as const;

export function getDemoHref(): string | null {
  if (!marketing.contact) return null;
  if (marketing.contact.kind === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(marketing.contact.value)) return null;
    const subject = "Quiero conocer Reserva";
    const body = "Hola, quiero conocer Reserva para mi peluquería o barbería. Me gustaría coordinar una demo.";
    return `mailto:${marketing.contact.value}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  const phone = marketing.contact.value.replace(/\D/g, "");
  if (!/^\d{8,15}$/.test(phone)) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent("Hola, quiero conocer Reserva para mi peluquería o barbería. Me gustaría coordinar una demo.")}`;
}
