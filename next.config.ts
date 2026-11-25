import type { NextConfig } from "next";

/** Cabeceras de seguridad para todas las respuestas. */
const COMMON_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];
/** Toda la app: no se puede incrustar en otros sitios (clickjacking). */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  ...COMMON_HEADERS,
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
/** Formularios públicos (/f/<empresa>): pensados para incrustarse en el sitio web de cada empresa. */
const EMBED_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors *" },
  ...COMMON_HEADERS,
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/((?!f/).*)", headers: SECURITY_HEADERS },
      { source: "/f/:path*", headers: EMBED_HEADERS },
    ];
  },
  // Workezt es 100% dinámica por request (sesión + organización activa): sin prerender de rutas.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
