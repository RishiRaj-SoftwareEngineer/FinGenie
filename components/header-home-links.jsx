"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HeaderHomeLinks() {
  const pathname = usePathname() || "";
  const isHome = pathname === "/";

  if (!isHome) return null;

  return (
    <>
      <a href="#features" className="text-foreground hover:text-primary">
        Features
      </a>
      <a href="#testimonials" className="text-foreground hover:text-primary">
        Testimonials
      </a>
    </>
  );
}
