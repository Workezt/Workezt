"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { btn } from "./ui-base";
import { completeVideoUpload, removeVideo, requestVideoUpload, type VideoTarget } from "@/app/(app)/media-actions";

const MAX_MB = 50;

/**
 * Sube un video directo al almacenamiento (sin pasar por el servidor de la app): pide una URL firmada,
 * hace PUT del archivo mostrando el avance y luego confirma el registro.
 */
export function VideoUploader({ target, label = "Subir video", replace = false, disabled = false }: {
  target: VideoTarget; label?: string; replace?: boolean; disabled?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) return setError(`El video pesa ${(file.size / 1048576).toFixed(0)} MB; el máximo es ${MAX_MB} MB. Comprímelo (p. ej. con HandBrake) e inténtalo de nuevo.`);
    const meta = { name: file.name, type: file.type || "video/mp4", size: file.size };
    const ticket = await requestVideoUpload(target, meta);
    if (!ticket.ok) return setError(ticket.error);
    setProgress(0);
    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", ticket.uploadUrl);
      xhr.setRequestHeader("content-type", meta.type);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(file);
    });
    if (!ok) {
      setProgress(null);
      return setError("La subida falló. Revisa tu conexión e inténtalo de nuevo.");
    }
    const done = await completeVideoUpload(target, { ...meta, path: ticket.path });
    setProgress(null);
    if (!done.ok) return setError(done.error);
    router.refresh();
  }

  return (
    <div>
      <input ref={input} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" disabled={disabled || progress !== null}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
      {progress === null ? (
        <button type="button" disabled={disabled} onClick={() => input.current?.click()} className={btn.secondary}>
          {replace ? "Cambiar video" : label}
        </button>
      ) : (
        <div className="w-full max-w-xs">
          <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Subiendo…</span><span>{progress} %</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--ork-violet)] transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
      <p className="mt-1.5 text-[11px] text-slate-400">MP4, WebM o MOV · máx. {MAX_MB} MB</p>
    </div>
  );
}

/** Botón para quitar un video (marca o artículo). */
export function RemoveVideoButton({ target, fileId, label = "Quitar" }: { target: VideoTarget; fileId?: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button type="button" disabled={pending} className="rounded-full px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        onClick={() => start(async () => { const r = await removeVideo(target, fileId); if (r.ok) router.refresh(); else setError(r.error); })}>
        {pending ? "Quitando…" : label}
      </button>
      {error && <span className="ml-2 text-xs text-rose-600">{error}</span>}
    </span>
  );
}
