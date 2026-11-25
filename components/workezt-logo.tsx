/* eslint-disable @next/next/no-img-element -- logos estáticos de la marca */

/**
 * Logotipo oficial Workezt (archivos en /public/brand):
 * - workezt-mark.png       → la "W" de dos cintas
 * - workezt-logo.png       → W + nombre en tinta oscura (fondos claros)
 * - workezt-logo-light.png → W + nombre en blanco (fondos oscuros)
 */
const MARK_RATIO = 507 / 264;
const LOGO_RATIO = 1829 / 264;

export function WorkeztMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/brand/workezt-mark.png"
      alt=""
      aria-hidden="true"
      width={Math.round(size * MARK_RATIO)}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      style={{ height: size, width: "auto" }}
    />
  );
}

export function WorkeztLogo({ size = 26, tone = "dark", byOrk = false }: { size?: number; tone?: "dark" | "light"; byOrk?: boolean }) {
  const h = Math.round(size * 1.05);
  const img = (src: string, cls = "") => (
    <img src={src} alt="Workezt" width={Math.round(h * LOGO_RATIO)} height={h} className={`shrink-0 ${cls}`} style={{ height: h, width: "auto" }} />
  );
  return (
    <span className="inline-flex items-center gap-2" aria-label="Workezt by OR-K">
      {tone === "light"
        ? img("/brand/workezt-logo-light.png")
        : <>{img("/brand/workezt-logo.png", "[html[data-mode=dark]_&]:hidden")}{img("/brand/workezt-logo-light.png", "hidden [html[data-mode=dark]_&]:inline-block")}</>}
      {byOrk && (
        <span className="ml-1 hidden items-center gap-1 text-[10px] font-medium text-stone-500 sm:inline-flex">
          by
          <img src={tone === "dark" ? "/brand/ork-logo-violet.png" : "/brand/ork-logo-white.png"} alt="OR-K" className="h-3.5 w-auto" />
        </span>
      )}
    </span>
  );
}
