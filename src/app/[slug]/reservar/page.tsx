import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Booking from "@/app/booking";
import { resolveBusiness } from "@/lib/business";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await resolveBusiness(slug);
  if (!business) return { title: "Negocio no disponible" };
  return { title: `Reservas | ${business.settings?.businessName ?? business.slug}` };
}

export default async function BusinessBookingPage({ params }: Props) {
  const { slug } = await params;
  const business = await resolveBusiness(slug);
  if (!business) notFound();
  return <Booking key={business.id} slug={business.slug} businessName={business.settings?.businessName ?? business.slug} />;
}

