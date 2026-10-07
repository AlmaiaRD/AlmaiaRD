"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ComprasRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/inventario?nueva-compra=true");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#D8CBBF]">
      <div className="w-8 h-8 border-2 border-[#BA4A3A] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
