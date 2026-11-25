"use client";

import { useState } from "react";
import { btn } from "./ui-base";

/** Copia un texto al portapapeles y confirma por 2 segundos. */
export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btn.small}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {}
      }}
    >
      {done ? "¡Copiado!" : label}
    </button>
  );
}
