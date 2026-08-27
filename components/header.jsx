// make it a Client Component

import React from "react";
import {
  SignedIn,
  SignedOut,
  UserButton,
  SignInButton,
} from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import { LayoutDashboard, PenBox } from "lucide-react";
import { checkUser } from "@/lib/checkUser";
import ThemeToggle from "./ui/theme-toggle";
import NotificationsBell from "./notifications-bell";
import HeaderHomeLinks from "./header-home-links";
import { isAdmin } from "@/lib/isAdmin";

const Header = async () => {
  await checkUser();
  const admin = await isAdmin();
  const dashboardHref = admin ? "/admin" : "/dashboard";

  return (
    <header className="fixed top-0 w-full bg-background/80 z-50 backdrop-blur-md border-b border-border">
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/">
          <Image
            src={"/logo1.png"}
            width={200}
            height={60}
            alt={"logo"}
            className="h-12 w-auto object-contain"
          />
        </Link>

        {/* Home-only Navigation Links */}
        <div className="hidden md:flex items-center space-x-8">
          <HeaderHomeLinks />
          <Link href="/goals" className="text-foreground hover:text-primary">
            Goals
          </Link>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-4">
          <SignedIn>
            <Link
              href={dashboardHref}
              className="text-foreground hover:text-primary flex items-center gap-2"
            >
              <Button variant="outline">
                <LayoutDashboard size={18} />
                <span className="hidden md:inline">Dashboard</span>
              </Button>
            </Link>
            <a href="/transaction/create">
              <Button className="flex items-center gap-2">
                <PenBox size={18} />
                <span className="hidden md:inline">Add Transaction</span>
              </Button>
            </a>
          </SignedIn>
          <SignedOut>
            <SignInButton forceRedirectUrl="/post-login">
              <Button variant="outline">Login</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <div className="flex items-center gap-2">
              <NotificationsBell />
              <ThemeToggle />
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10",
                  },
                }}
              />
            </div>
          </SignedIn>
        </div>
      </nav>
    </header>
  );
};

export default Header;
