import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface DrawerProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Drawer({ open, children }: DrawerProps) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 flex justify-end">
        <div className="pointer-events-auto h-full w-full max-w-md overflow-y-auto rounded-l-xl bg-white p-4 shadow-lg dark:bg-gray-800 dark:text-white">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function DrawerContent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function DrawerHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('mb-4', className)}>{children}</div>;
}

export function DrawerFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('mt-4', className)}>{children}</div>;
}

export function DrawerTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h2 className={cn('text-lg font-semibold', className)}>{children}</h2>;
}

export function DrawerDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn('text-sm text-gray-500', className)}>{children}</p>;
}
