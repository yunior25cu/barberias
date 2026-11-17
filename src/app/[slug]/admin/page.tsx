import { notFound } from "next/navigation";
import Admin from "@/app/admin/admin";
import { resolveBusiness } from "@/lib/business";

export default async function BusinessAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await resolveBusiness(slug);
  if (!business) notFound();
  return <Admin key={business.id} slug={business.slug} businessName={business.settings?.businessName ?? business.slug} />;
}

