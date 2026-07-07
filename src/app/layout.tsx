import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Great_Vibes } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import KillServiceWorker from "@/components/KillServiceWorker";
import ErrorBoundary from "@/components/ErrorBoundary";
import ToastProvider from "@/components/ui/ToastProvider";



const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const greatVibes = Great_Vibes({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-signature",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Almaia RD - Gestión Comercial",
  description: "Sistema de gestión comercial para submarcas Amway",
  icons: {
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport = {
  themeColor: "#B8837E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${jakarta.variable} ${greatVibes.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FCFAF7] text-[#5C3E35]">
        <KillServiceWorker />
        <ErrorBoundary>
          <AuthProvider>
            <ToastProvider />
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
