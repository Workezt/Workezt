import { notFound } from "next/navigation";
import Link from "@/components/plink";
import { AppGrid } from "@/components/app-grid";
import { AppIcon } from "@/components/app-icons";
import { requireContext } from "@/lib/core/context";
import { launcherApps } from "@/lib/launcher";
import { CATEGORIES, categoryByApp } from "@/lib/launcher-categories";

type CategoryPageProps = { params: Promise<{ categoria: string }> };

export async function generateMetadata({ params }: CategoryPageProps) {
  const { categoria } = await params;
  return { title: CATEGORIES.find(({ key }) => key === categoria)?.name ?? "Aplicaciones" };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categoria } = await params;
  const category = CATEGORIES.find(({ key }) => key === categoria);
  if (!category) notFound();

  const ctx = await requireContext();
  const customs = await ctx.db.customEntity.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  const apps = launcherApps(ctx, customs);
  const items = apps
    .filter(({ key }) => (categoryByApp.get(key) ?? "administracion") === category.key)
    .map((app) => ({
      key: app.key,
      tile: (
        <Link href={app.href} className="flex flex-col items-center gap-2.5 rounded-3xl text-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--ork-violet)]">
          <span className="app-tile grid h-[84px] w-[84px] place-items-center sm:h-[96px] sm:w-[96px]">
            <AppIcon name={app.icon} size={76} pack="area" palette={category.palette} />
          </span>
          <span className="max-w-[124px] text-[13px] font-medium leading-tight text-stone-800">{app.name}</span>
        </Link>
      ),
    }));

  return (
    <section className="pb-20">
      <Link href="/" className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-[var(--ork-violet)] hover:underline">
        <span aria-hidden="true">←</span> Volver a categorías
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold text-[var(--ork-ink)]">{category.name}</h1>
      <AppGrid items={items} allKeys={apps.map(({ key }) => key)} />
    </section>
  );
}
