import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:{default:"Administración de negocios",template:"%s | Al Corte"},description:"Administración de negocios y reservas."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es-UY"><body>{children}</body></html>}
