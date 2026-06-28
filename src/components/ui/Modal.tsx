"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
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
              "relative bg-white rounded-2xl sm:rounded-3xl shadow-xl w-full mx-0 sm:mx-auto max-h-[90vh] sm:max-h-none overflow-hidden",
              wide ? "max-w-3xl" : "max-w-lg"
            )}
          >
            <div className="bg-[#5C3E35] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <div>
                <h2 className="text-white text-base sm:text-lg font-semibold">{title}</h2>
                {subtitle && (
                  <p className="text-[#D4C8C0] text-xs sm:text-sm mt-0.5">{subtitle}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[75vh]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
