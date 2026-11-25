import { requireModule } from "@/lib/core/context";
import { TeamView } from "../_ui/views-admin";

export const metadata = { title: "Equipo y costos · Flipper" };

export default async function Page() {
  await requireModule("flipper", "flipper.internal");
  return <TeamView />;
}
