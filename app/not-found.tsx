import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <p className="text-sm font-semibold text-violet-600">Workezt · 404</p>
      <h1 className="mt-3 text-2xl font-semibold">Esta página no está disponible</h1>
      <p className="mt-3 text-sm text-stone-600">El enlace puede haber cambiado, el registro ya no está disponible o esta aplicación no está activa para tu empresa.</p>
      <Link href="/" className="mt-6 inline-flex rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white">Volver al inicio</Link>
    </main>
  );
}
