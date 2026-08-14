"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}

export default function Modal({ isOpen, onClose, title, subtitle, children, wide }: ModalProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "relative bg-white rounded-2xl sm:rounded-3xl shadow-xl w-full mx-0 sm:mx-auto overflow-hidden",
              expanded
                ? "max-w-[98vw] sm:max-w-[95vw] h-[96vh] sm:h-[94vh]"
                : cn("max-h-[90vh] sm:max-h-[90vh] max-h-[calc(100vh-2rem)]", wide ? "max-w-3xl" : "max-w-lg")
            )}
          >
            <div className="bg-foreground px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <h2 className="text-white text-base sm:text-lg font-semibold">{title}</h2>
                {subtitle && (
                  <p className="text-[#D4C8C0] text-xs sm:text-sm mt-0.5">{subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setExpanded((v) => !v)}
                  title={expanded ? "Restaurar tamaño" : "Expandir espacio de trabajo"}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className={cn("p-4 sm:p-6 overflow-y-auto", expanded ? "h-[calc(96vh-64px)] sm:h-[calc(94vh-68px)]" : "max-h-[75vh]")}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
