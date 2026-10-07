"use client";

import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: "#fff",
          color: "#39484F",
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "14px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          border: "1px solid #E0DAD3",
        },
        success: {
          iconTheme: { primary: "#86C7A3", secondary: "#fff" },
        },
        error: {
          iconTheme: { primary: "#D4A0A0", secondary: "#fff" },
        },
      }}
    />
  );
}
