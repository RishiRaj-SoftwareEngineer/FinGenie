import { Inter } from "next/font/google";
import "./globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/components/header";
import { Toaster } from "@/components/ui/sonner";
import ThemeProviderWrapper from "@/components/ui/theme-provider";
import ChatLauncherGate from "@/components/chat/chat-launcher-gate";
import Image from "next/image";
import Link from "next/link";
import ScrollToTop from "@/components/scroll-to-top";

//import { Toaster } from "sonner";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "FinGenie",
  description: "AI-Driven Personal Finance Management Platform",
};

export default function RootLayout({ children }) {
  const currentYear = new Date().getUTCFullYear();

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.className}`} suppressHydrationWarning>
          <ThemeProviderWrapper>
            <ScrollToTop />
            {children}
            <Header />
            <ChatLauncherGate />

            <Toaster richColors />

            <footer className="border-t border-border bg-background">
              <div className="container mx-auto px-4 py-14">
                <div className="grid grid-cols-1 gap-10 md:grid-cols-5">
                  <div className="md:col-span-2">
                    <Link href="/" className="inline-block">
                      <Image
                        src="/logo1.png"
                        width={170}
                        height={52}
                        alt="FinGenie"
                        className="h-11 w-auto object-contain"
                      />
                    </Link>
                    <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
                      Your AI-powered personal finance companion. Smarter
                      decisions. Better financial habits.
                    </p>
                  </div>

                  <FooterColumn
                    title="Product"
                    links={[
                      ["Dashboard", "/dashboard"],
                      ["Transactions", "/transaction/create"],
                      ["Goals", "/goals"],
                      ["AI Insights", "/goals/recommendations"],
                      ["Chat History", "/chat-history"],
                    ]}
                  />
                  <FooterColumn
                    title="Resources"
                    links={[
                      ["About", "/#features"],
                      ["How It Works", "/#how-it-works"],
                      ["Contact", "mailto:reeshiraj01@gmail.com"],
                    ]}
                  />
                  <FooterColumn
                    title="Legal"
                    links={[
                      ["Privacy Policy", "/privacy"],
                      ["Terms of Service", "/terms"],
                      ["Financial Disclaimer", "/disclaimer"],
                    ]}
                  />
                </div>

                <p className="mt-10 max-w-5xl text-xs leading-5 text-muted-foreground">
                  Disclaimer: FinGenie provides financial information and
                  insights for educational purposes only and does not constitute
                  financial, investment, tax, or legal advice.
                </p>

                <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <p>&copy; {currentYear} FinGenie. All rights reserved.</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>Developed by</span>
                    <a
                      href="https://github.com/RishiRaj-SoftwareEngineer"
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-foreground hover:text-primary"
                    >
                      Rishi Raj Pandey
                    </a>
                    <span aria-hidden="true">&middot;</span>
                    <span>Built for smarter financial decisions.</span>
                  </div>
                </div>
              </div>
            </footer>
          </ThemeProviderWrapper>
        </body>
      </html>
    </ClerkProvider>
  );
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ul className="mt-4 space-y-3">
        {links.map(([label, href]) => (
          <li key={label}>
            {href.startsWith("http") || href.startsWith("mailto:") ? (
              <a
                href={href}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                {label}
              </a>
            ) : (
              <Link
                href={href}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
