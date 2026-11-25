import { LoginScreen } from "./login-screen";

export const metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return <LoginScreen next={typeof next === "string" ? next : undefined} />;
}
