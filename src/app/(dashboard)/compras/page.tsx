"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ComprasRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/inventario?nueva-compra=true");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FCFAF7]">
      <div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
