"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/layout/Header";
import NavMenu from "@/components/layout/NavMenu";
import Footer from "@/components/layout/Footer";
import FloatingActionButton from "@/components/layout/FloatingActionButton";
import BackToTop from "@/components/layout/BackToTop";
import QueryProvider from "@/components/providers/QueryProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5EFE9]">
        <div className="w-10 h-10 border-2 border-[#BA4A3A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <QueryProvider>
      <div className="min-h-screen flex flex-col bg-[#F5EFE9]">
        <Header />
        <div className="border-b border-[#E0DAD3] bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
            <NavMenu />
          </div>
        </div>
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
        <FloatingActionButton />
        <BackToTop />
      </div>
    </QueryProvider>
  );
}
