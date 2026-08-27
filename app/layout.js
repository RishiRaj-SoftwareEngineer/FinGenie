import { Inter } from "next/font/google";
import "./globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/components/header";
import { Toaster } from "@/components/ui/sonner";
import ThemeProviderWrapper from "@/components/ui/theme-provider";
import ChatLauncherGate from "@/components/chat/chat-launcher-gate";

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
            {children}
            <Header />
            <ChatLauncherGate />

            <Toaster richColors />

            <footer className="bg-blue-100 dark:bg-background py-12">
              <div className="container mx-auto py-8">
                <p className="text-center text-gray-600 dark:text-muted-foreground">
                  &copy; {currentYear} FinGenie. All rights
                  reserved.
                </p>
              </div>
            </footer>
          </ThemeProviderWrapper>
        </body>
      </html>
    </ClerkProvider>
  );
}
