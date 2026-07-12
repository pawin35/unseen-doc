import { requireSession } from "@/lib/session";
import { logout } from "@/actions/auth";
import { NavLinks } from "./nav-links";

export default async function AuthedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireSession();

  return (
    <>
      <a href="#main-content" className="skip-link">
        ข้ามไปยังเนื้อหาหลัก
      </a>
      <header className="app-header">
        <span className="brand">Unseen Docs</span>
        <nav aria-label="เมนูหลัก" className="app-nav">
          <NavLinks />
        </nav>
        <form action={logout}>
          <button type="submit">ออกจากระบบ</button>
        </form>
      </header>
      <main id="main-content">{children}</main>
    </>
  );
}
