import type { Metadata } from "next";
import Activation from "./activation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activar acceso", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function ActivatePage() { return <Activation />; }
