"use client";

import { X } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  overlayClassName?: string;
  panelClassName?: string;
  showCloseButton?: boolean;
  closeButtonClassName?: string;
}

export function Modal({
  open,
  onClose,
  children,
  overlayClassName,
  panelClassName,
  showCloseButton = true,
  closeButtonClassName,
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4",
        overlayClassName,
      )}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-3xl bg-white shadow-2xl",
          panelClassName,
        )}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700",
              closeButtonClassName,
            )}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
