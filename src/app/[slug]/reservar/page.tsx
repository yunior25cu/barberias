import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Booking from "@/app/booking";
import { resolveBusiness } from "@/lib/business";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await resolveBusiness(slug);
  if (!business) return { title: { absolute: "Negocio no disponible" }, robots: { index: false, follow: false } };
  const businessName = business.settings?.businessName ?? business.slug;
  const title = `${businessName} – Reservá tu hora`;
  const description = "Elegí tu servicio y reservá tu hora en pocos pasos.";
  return {
    title: { absolute: title },
    description,
    openGraph: { type: "website", title, description, siteName: businessName, locale: "es_UY" },
    twitter: { card: "summary", title, description },
  };
}

export default async function BusinessBookingPage({ params }: Props) {
  const { slug } = await params;
  const business = await resolveBusiness(slug);
  if (!business) notFound();
  return <Booking key={business.id} slug={business.slug} businessName={business.settings?.businessName ?? business.slug} />;
}
