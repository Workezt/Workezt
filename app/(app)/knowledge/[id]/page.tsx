import Link from "@/components/plink";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/core/context";
import { orgUsers } from "@/lib/core/members";
import { graphNodes } from "@/lib/apps/graph";
import { KNOWLEDGE_TYPES, RELATIONS } from "@/lib/apps/knowledge";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, btn, Card, Field, input, PageHeader, SEVERITY_LABEL, SEVERITY_TONE } from "@/components/ui";
import { dateTime } from "@/lib/ui/format";
import { addRelation, approveKnowledge, saveKnowledge } from "../actions";
import { RemoveVideoButton, VideoUploader } from "@/components/video-uploader";
import { fileUrl } from "@/lib/core/files";
import { mediaConfigured } from "@/lib/core/media";

const REL = Object.fromEntries(RELATIONS.map((r) => [r.value, r.label]));

export default async function KnowledgeDetail({ params }: PageProps<"/knowledge/[id]">) {
  const ctx = await requireModule("knowledge", "knowledge.read");
  const { id } = await params;
  const k = await ctx.db.knowledgeItem.findUnique({ where: { id }, include: { versions: { orderBy: { version: "desc" } } } });
  if (!k) notFound();
  const [users, nodes, edges, insights, videos] = await Promise.all([
    orgUsers(ctx), graphNodes(ctx),
    ctx.db.graphEdge.findMany({ where: { OR: [{ fromType: "KNOWLEDGE", fromId: id }, { toType: "KNOWLEDGE", toId: id }] } }),
    ctx.hasModule("radar") && ctx.can("radar.read") ? ctx.db.insight.findMany({ where: { entityType: "knowledge", entityId: id, status: "OPEN" } }) : [],
    ctx.db.fileObject.findMany({ where: { entityType: "knowledge_video", entityId: id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, size: true } }),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const self = `KNOWLEDGE:${id}`;
  const canWrite = ctx.can("knowledge.write");

  return (
    <>
      <PageHeader title={k.title} crumbs={[{ label: "Conocimiento", href: "/knowledge" }, { label: k.title }]}
        subtitle={<span className="flex flex-wrap items-center gap-2">
          {KNOWLEDGE_TYPES.find((t) => t.value === k.type)?.label} · v{k.version} · dueño {k.ownerId ? userMap.get(k.ownerId) : "—"}
          <Badge tone={SEVERITY_TONE[k.criticality]}>Criticidad {SEVERITY_LABEL[k.criticality]}</Badge>
          <Badge tone={k.status === "published" ? "emerald" : "slate"}>{k.status === "published" ? `Publicado por ${userMap.get(k.approvedById ?? "") ?? ""}` : "Borrador"}</Badge>
        </span>}
        actions={k.status !== "published" && ctx.can("knowledge.approve") && (
          <ActionForm action={approveKnowledge}><input type="hidden" name="id" value={k.id} /><SubmitButton className={btn.primary}>Aprobar y publicar</SubmitButton></ActionForm>
        )} />
      {insights.length > 0 && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {insights.map((i) => <p key={i.id}><b>Radar:</b> {i.title}. {i.detail} → {i.recommendedAction}</p>)}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Contenido">
            {canWrite ? (
              <ActionForm action={saveKnowledge} className="space-y-3">
                <input type="hidden" name="id" value={k.id} />
                <input name="title" defaultValue={k.title} className={input} aria-label="Título" />
                <textarea name="body" defaultValue={k.body} rows={14} className={`${input} font-mono`} aria-label="Contenido" />
                <SubmitButton className={btn.secondary}>Guardar nueva versión</SubmitButton>
              </ActionForm>
            ) : <pre className="whitespace-pre-wrap text-sm">{k.body}</pre>}
          </Card>
          {(videos.length > 0 || canWrite) && (
            <Card title={`Videos${videos.length ? ` · ${videos.length}` : ""}`}>
              {videos.length === 0 && <p className="mb-3 text-sm text-slate-500">Agrega un video para explicar el procedimiento (inducción, paso a paso en planta…).</p>}
              <div className="space-y-5">
                {videos.map((v) => (
                  <figure key={v.id}>
                    <video src={fileUrl(v.id)} controls playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-black" />
                    <figcaption className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="truncate">{v.name} · {(v.size / 1048576).toFixed(1)} MB</span>
                      {canWrite && <RemoveVideoButton target={{ kind: "knowledge", itemId: k.id }} fileId={v.id} />}
                    </figcaption>
                  </figure>
                ))}
              </div>
              {canWrite && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {mediaConfigured()
                    ? <VideoUploader target={{ kind: "knowledge", itemId: k.id }} label="Agregar video" />
                    : <p className="text-xs text-amber-700">El almacenamiento de videos aún no está configurado.</p>}
                </div>
              )}
            </Card>
          )}
          <Card title="Historial de versiones" padded={false}>
            <ul className="divide-y divide-slate-100 text-sm">
              {k.versions.map((v) => <li key={v.id} className="flex justify-between px-5 py-2"><span>v{v.version} · {v.title}</span><span className="text-xs text-slate-400">{v.createdById ? userMap.get(v.createdById) : ""} · {dateTime(v.createdAt)}</span></li>)}
            </ul>
          </Card>
        </div>
        <Card title="Relaciones (grafo)">
          <ul className="mb-4 space-y-2 text-sm">
            {edges.map((e) => {
              const from = nodes.get(`${e.fromType}:${e.fromId}`), to = nodes.get(`${e.toType}:${e.toId}`);
              return (
                <li key={e.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <span className={`${e.fromType}:${e.fromId}` === self ? "font-medium" : ""}>{from?.label ?? e.fromType}</span>
                  <span className="mx-1 text-xs text-slate-500">{REL[e.relation] ?? e.relation}</span>
                  {e.toType === "KNOWLEDGE" && e.toId !== id ? <Link href={`/knowledge/${e.toId}`} className="hover:underline">{to?.label}</Link> : <span className={`${e.toType}:${e.toId}` === self ? "font-medium" : ""}>{to?.label ?? e.toType}</span>}
                </li>
              );
            })}
            {edges.length === 0 && <li className="text-slate-400">Sin relaciones.</li>}
          </ul>
          {canWrite && (
            <ActionForm action={addRelation} className="space-y-2 border-t border-slate-100 pt-3">
              <input type="hidden" name="id" value={k.id} />
              <Field label="Origen"><select name="source" defaultValue={self} className={input}>{[...nodes.entries()].map(([key, n]) => <option key={key} value={key}>{n.sub}: {n.label}</option>)}</select></Field>
              <Field label="Relación"><select name="relation" className={input}>{RELATIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
              <Field label="Destino"><select name="target" className={input}>{[...nodes.entries()].map(([key, n]) => <option key={key} value={key}>{n.sub}: {n.label}</option>)}</select></Field>
              <SubmitButton className={btn.secondary}>Agregar relación</SubmitButton>
            </ActionForm>
          )}
        </Card>
      </div>
    </>
  );
}
