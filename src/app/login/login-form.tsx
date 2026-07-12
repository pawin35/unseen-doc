"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction}>
      {state.error ? (
        <p role="alert" className="field-error">
          {state.error}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="username">ชื่อผู้ใช้</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          aria-invalid={state.error ? true : undefined}
        />
      </div>
      <div className="field">
        <label htmlFor="password">รหัสผ่าน</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.error ? true : undefined}
        />
      </div>
      <button type="submit" className="primary" disabled={pending}>
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
