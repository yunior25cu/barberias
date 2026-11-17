import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Admin from "@/app/admin/admin";
import { resolveBusiness } from "@/lib/business";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const business = await resolveBusiness((await params).slug);
  if (!business) return { title: { absolute: "Negocio no disponible" }, robots: { index: false, follow: false } };
  const businessName = business.settings?.businessName ?? business.slug;
  const title = `Panel del responsable | ${businessName}`;
  const description = `Acceso privado para administrar las reservas y la agenda de ${businessName}.`;
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    openGraph: { type: "website", title, description, siteName: businessName, locale: "es_UY" },
    twitter: { card: "summary", title, description },
  };
}

export default async function BusinessAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await resolveBusiness(slug);
  if (!business) notFound();
  return <Admin key={business.id} slug={business.slug} businessName={business.settings?.businessName ?? business.slug} />;
}
