"use client";

import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  confirmDisabled?: boolean;
  className?: string;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  icon,
  onConfirm,
  onCancel,
  onClose,
  confirmDisabled,
  className,
}: ConfirmDialogProps) {
  const handleClose = onClose ?? onCancel;

  return (
    <Modal
      open={open}
      onClose={handleClose ?? (() => undefined)}
      panelClassName={cn("max-w-md w-full p-6 sm:p-8 text-center relative", className)}
    >
      {icon && <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">{icon}</div>}
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed mb-6">{description}</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          onClick={onCancel}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-all"
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={confirmDisabled}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
