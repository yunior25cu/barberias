import type { Metadata } from "next";
import Platform from "./platform";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administración de negocios", robots: { index: false, follow: false } };

export default function PlatformPage() { return <Platform />; }
