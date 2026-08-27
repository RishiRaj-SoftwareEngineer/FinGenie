"use client";

import { usePathname } from "next/navigation";
import ChatLauncher from "./ChatLauncher";

export default function ChatLauncherGate() {
  const pathname = usePathname() || "";
  const isAdminRoute = pathname.startsWith("/admin");
  const isAuthRoute =
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.includes("/sign-in") ||
    pathname.includes("/sign-up");

  if (isAdminRoute || isAuthRoute) return null;
  return <ChatLauncher />;
}
