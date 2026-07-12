"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "ใบเสนอราคา" },
  { href: "/customers", label: "ลูกค้า" },
  { href: "/company", label: "ข้อมูลกิจการ" },
  { href: "/templates", label: "แบบฟอร์มเอกสาร" },
] as const;

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/quotations");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <ul>
      {LINKS.map(({ href, label }) => (
        <li key={href}>
          <Link href={href} aria-current={isCurrent(pathname, href) ? "page" : undefined}>
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
