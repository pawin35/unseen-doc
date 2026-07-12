"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Compare against self to keep timing independent of the mismatch position.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export interface LoginState {
  error?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const expectedUser = process.env.ADMIN_USERNAME ?? "";
  const expectedPass = process.env.ADMIN_PASSWORD ?? "";

  if (!expectedUser || !expectedPass) {
    return { error: "ระบบยังไม่ได้ตั้งค่าบัญชีผู้ดูแล (ADMIN_USERNAME/ADMIN_PASSWORD)" };
  }

  const userOk = safeEqual(username, expectedUser);
  const passOk = safeEqual(password, expectedPass);
  if (!userOk || !passOk) {
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }

  const session = await getSession();
  session.authed = true;
  await session.save();
  redirect("/");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
