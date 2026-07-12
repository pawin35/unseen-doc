import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export interface SessionData {
  authed?: boolean;
}

// Resolved lazily so importing this module never throws at build time
// (next build collects route modules without runtime env like SESSION_SECRET).
function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password) {
    throw new Error("SESSION_SECRET is not set");
  }
  return {
    password,
    cookieName: "unseen_doc_session",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

/** Server-component/route guard: redirects to /login when not authenticated. */
export async function requireSession() {
  const session = await getSession();
  if (!session.authed) {
    redirect("/login");
  }
  return session;
}

/** Route-handler guard variant: returns false instead of redirecting. */
export async function isAuthed(): Promise<boolean> {
  const session = await getSession();
  return session.authed === true;
}
