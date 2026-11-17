import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Al Corte — Reservá tu hora",description:"Elegí tu servicio y reservá tu hora en pocos pasos."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es-UY"><body>{children}</body></html>}
