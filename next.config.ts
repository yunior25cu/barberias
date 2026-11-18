import type { NextConfig } from "next";
const securityHeaders=[{key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},{key:"X-Frame-Options",value:"DENY"},{key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"}];
if(process.env.NODE_ENV==="production")securityHeaders.push({key:"Content-Security-Policy",value:"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.blob.core.windows.net; frame-src 'self' https://www.google.com https://maps.google.com; font-src 'self' data:; connect-src 'self' https://*.blob.core.windows.net; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"});
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  output: "standalone",
  serverExternalPackages: ["@prisma/adapter-mssql", "mssql", "tedious", "@azure/identity", "@azure/storage-blob", "open", "powershell-utils", "wsl-utils"],
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  headers: async () => [
    { source: "/:path*", headers: securityHeaders },
    { source: "/activar/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }, { key: "Referrer-Policy", value: "no-referrer" }] },
  ],
};
export default config;
