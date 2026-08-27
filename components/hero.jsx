"use client";

import Link from "next/link";
import React, { useEffect, useRef } from "react";
import { Button } from "./ui/button";
import Image from "next/image";

const HeroSection = ({ ctaHref = "/sign-up" }) => {
  const imageRef = useRef();
  useEffect(() => {
    const imageElement = imageRef.current;
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const scrollThreshold = 100;

      if (scrollPosition > scrollThreshold) {
        imageElement.classList.add("scrolled");
      } else {
        imageElement.classList.remove("scrolled");
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <section className="pt-40 pb-20 px-4">
      <div className="w-full max-w-[1280px] mx-auto text-center">
        <h1 className="text-5xl md:text-8xl lg:text-[105px] pb-6 gradient-title">
          Manage your finances <br />
          with clarity
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto ">
          A simple financial management platform that helps you track, plan, and
          improve your spending with clear insights.
        </p>
        <div className="flex justify-center space-x-8 mb-4 ">
          <Link href={ctaHref}>
            <Button size="lg" className="px-8">
              Get Started
            </Button>
          </Link>
        </div>
        <div className="hero-image-wrapper mt-10 md:mt-10 overflow-hidden">
          <div ref={imageRef} className="hero-image">
            <Image
              src="/banner1.jpeg"
              width={1280}
              height={720}
              alt="banner"
              className="rounded-lg shadow-2xl border w-full"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
