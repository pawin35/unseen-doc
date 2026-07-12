import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session.authed) {
    redirect("/");
  }
  return (
    <main>
      <h1>เข้าสู่ระบบ Flow Clone</h1>
      <LoginForm />
    </main>
  );
}
