'use client';
import { type ReactNode, useRef } from 'react';
import { Button } from './primitives';

/** A button that asks for confirmation in a modal dialog before running `onConfirm`. */
export function ConfirmButton({
  children,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'secondary',
  confirmVariant = 'danger',
  size = 'sm',
  pending,
  onConfirm,
  className,
}: {
  children: ReactNode;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  confirmVariant?: 'primary' | 'danger';
  size?: 'sm' | 'md';
  pending?: boolean;
  onConfirm: () => void;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button variant={variant} size={size} pending={pending} className={className} onClick={() => dialog.current?.showModal()}>
        {children}
      </Button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-ink shadow-xl backdrop:bg-black/40"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <h2 className="text-base font-semibold">{title}</h2>
        {message ? <div className="mt-2 text-sm text-ink-2">{message}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => dialog.current?.close()}>
            Keep
          </Button>
          <Button
            variant={confirmVariant}
            onClick={() => {
              dialog.current?.close();
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}
