import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Admin from "@/app/admin/admin";
import { resolveBusiness } from "@/lib/business";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const business = await resolveBusiness((await params).slug);
  return { title: business ? `Administración | ${business.settings?.businessName ?? business.slug}` : "Negocio no disponible" };
}

export default async function BusinessAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await resolveBusiness(slug);
  if (!business) notFound();
  return <Admin key={business.id} slug={business.slug} businessName={business.settings?.businessName ?? business.slug} />;
}
