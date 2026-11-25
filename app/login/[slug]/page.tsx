import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/core/prisma";
import { signedMediaUrl } from "@/lib/core/media";
import { LoginScreen, type LoginBrand } from "../login-screen";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string }> };

/** Marca pública de una empresa activa para su login propio; null si no existe. */
async function brandOf(slug: string): Promise<LoginBrand | null> {
  const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, status: true, branding: true } });
  if (!org || org.status !== "ACTIVE") return null;
  const b = (org.branding ?? {}) as { displayName?: string; logoUrl?: string; loginVideoId?: string };
  let videoUrl: string | null = null;
  if (b.loginVideoId) {
    const f = await prisma.fileObject.findFirst({ where: { id: b.loginVideoId, organizationId: org.id }, select: { storageKey: true } });
    videoUrl = f ? await signedMediaUrl(f.storageKey) : null;
  }
  return { slug: org.slug, name: b.displayName || org.name, logoUrl: b.logoUrl, videoUrl };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = await brandOf((await params).slug);
  return { title: brand ? `Ingresar · ${brand.name}` : "Ingresar", robots: { index: false } };
}

/** Login con la marca de la empresa: /login/presservac */
export default async function OrgLoginPage({ params, searchParams }: Props) {
  const [{ slug }, { next }] = await Promise.all([params, searchParams]);
  const brand = await brandOf(slug);
  if (!brand) notFound();
  return <LoginScreen brand={brand} next={typeof next === "string" ? next : undefined} />;
}
