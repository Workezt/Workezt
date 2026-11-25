import { requireModule } from "@/lib/core/context";
import { loadFlipper } from "@/lib/apps/flipper/server";
import { FlipperProvider } from "./_ui/store";
import { FlipperBar } from "./_ui/bar";

export const metadata = { title: "Flipper" };

/** Flipper: el estado de la organización se carga una vez y vive en el navegador mientras se navega entre sus módulos. */
export default async function FlipperLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireModule("flipper", "flipper.read");
  const data = await loadFlipper(ctx);
  return (
    <FlipperProvider initial={data.state} perms={data.perms} userId={data.userId} fresh={data.fresh}>
      <div className="fl-root">
        <FlipperBar />
        {children}
      </div>
    </FlipperProvider>
  );
}
