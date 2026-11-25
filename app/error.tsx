"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24" role="alert">
      <p className="text-sm font-semibold text-violet-600">Workezt</p>
      <h1 className="mt-3 text-2xl font-semibold">No pudimos cargar esta pantalla</h1>
      <p className="mt-3 text-sm text-stone-600">Intenta cargarla de nuevo. Si estabas guardando un cambio, comprueba el registro antes de repetir la operación.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={() => retry()} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2">Volver a intentar</button>
        <Link href="/" className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium">Ir al inicio</Link>
      </div>
    </main>
  );
}
