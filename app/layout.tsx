import type { Metadata } from "next";
import { Anton, DM_Sans, Instrument_Serif, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import "./accessibility.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400" });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["500", "600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Workezt", template: "%s · Workezt" },
  description: "Workezt by OR-K — la operación de tu empresa, en armonía.",
};

/** Aplica el modo claro/oscuro guardado antes de pintar (sin destello). Ver components/theme-toggle.tsx */
const MODE_SCRIPT = `try{var m=localStorage.getItem("wz.mode");var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.mode=d?"dark":"light"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${dmSans.variable} ${anton.variable} ${instrument.variable} ${geistMono.variable} ${poppins.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
