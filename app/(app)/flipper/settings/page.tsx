import { requireModule } from "@/lib/core/context";
import { SettingsView } from "../_ui/views-admin";

export const metadata = { title: "Configuración · Flipper" };

export default async function Page() {
  await requireModule("flipper", "flipper.internal");
  return <SettingsView />;
}
