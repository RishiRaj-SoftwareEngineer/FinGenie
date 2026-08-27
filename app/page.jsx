import HeroSection from "@/components/hero";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  featuresData,
  howItWorksData,
  testimonialsData,
} from "@/data/landing";

import Image from "next/image";
import Link from "next/link";
export default async function Home() {
  const { userId } = await auth();
  let ctaHref = "/sign-up";
  if (userId) {
    try {
      const currentUser = await db.user.findUnique({
        where: { clerkUserId: userId },
        select: { role: true },
      });
      ctaHref = currentUser?.role === "ADMIN" ? "/admin" : "/dashboard";
    } catch {
      ctaHref = "/dashboard";
    }
  }
  const compact = new Intl.NumberFormat("en", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });
  const fallbackStats = [
    { value: "50K+", label: "Active Users" },
    { value: "Rs.2B+", label: "Transactions Tracked" },
    { value: "99.9%", label: "Uptime" },
    { value: "4.9/5", label: "User Rating" },
  ];
  let landingStats = fallbackStats;

  try {
    const [activeUsers, txAggregate] = await Promise.all([
      db.user.count(),
      db.transaction.aggregate({ _sum: { amount: true } }),
    ]);

    const txRaw = txAggregate?._sum?.amount;
    const transactionVolume =
      txRaw != null
        ? typeof txRaw?.toNumber === "function"
          ? txRaw.toNumber()
          : Number(txRaw)
        : 0;

    landingStats = [
      { value: `${compact.format(activeUsers)}+`, label: "Active Users" },
      {
        value: `Rs.${compact.format(Math.max(0, transactionVolume))}`,
        label: "Transactions Tracked",
      },
      { value: "99.9%", label: "Uptime" },
      { value: "4.9/5", label: "User Rating" },
    ];
  } catch (error) {
    console.error("Failed to load dynamic landing stats:", error);
  }

  return (
    <div>
      {/* Hero Section */}
      <HeroSection ctaHref={ctaHref} />

      {/* Stats Section */}
      <section id="how-it-works" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {landingStats.map((statsData, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {statsData.value}
                </div>
                <div className="text-muted-foreground">{statsData.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything you need to manage your finances at home
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuresData.map((feature, index) => (
              <Card className="p-6" key={index}>
                <CardContent className="space-y-4 pt-4">
                  {feature.icon}
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {howItWorksData.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-border rounded-full flex items-center justify-center mx-auto mb-6">
                  {step.icon}
                </div>
                <h3 className="text-xl font-semibold mb-4">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">
            What Our Users Say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonialsData.map((testimonial, index) => (
              <Card key={index} className="p-6">
                <CardContent className="pt-4">
                  <div className="flex items-center mb-4">
                    <Image
                      src={testimonial.image}
                      alt={testimonial.name}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                    <div className="ml-4">
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role}
                      </div>
                    </div>
                  </div>
                  <p className="text-muted-foreground">{testimonial.quote}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-300 dark:bg-background">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-4xl rounded-2xl p-12 bg-transparent dark:bg-card dark:border-border dark:p-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ready to Take Control of Your Finances?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of users who are already managing their finances
              smarter
            </p>
            <Link href={ctaHref}>
              <Button
                size="lg"
                className="bg-white text-blue-900 hover:opacity-90 animate-bounce dark:bg-blue-800 dark:text-white"
              >
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
