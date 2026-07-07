"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/layout/Header";
import NavMenu from "@/components/layout/NavMenu";
import Footer from "@/components/layout/Footer";
import FloatingActionButton from "@/components/layout/FloatingActionButton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) return null;

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAF7]">
      <Header />
      <div className="border-b border-[#E8E0D8] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
          <NavMenu />
        </div>
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
      <Footer />
      <FloatingActionButton />
    </div>
  );
}
