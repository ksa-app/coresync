"use client";

import { ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
};

export default function Modal({ open, title, onClose, children, footer, maxWidth = "max-w-[520px]" }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`bg-white rounded-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto shadow-2xl`}>
        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-base font-bold m-0">{title}</h3>
          <button onClick={onClose} className="text-gray-400 text-lg border-none bg-transparent cursor-pointer">
            ✕
          </button>
        </div>
        <div className="px-5 py-5 flex flex-col gap-3.5">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2.5">{footer}</div>}
      </div>
    </div>
  );
}
