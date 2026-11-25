import { requireModule } from "@/lib/core/context";
import { ProfitView } from "../_ui/views-admin";

export const metadata = { title: "Rentabilidad · Flipper" };

export default async function Page() {
  await requireModule("flipper", "flipper.internal");
  return <ProfitView />;
}
