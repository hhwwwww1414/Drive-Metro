'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Drawer, DrawerContent } from './ui/drawer';

export default function FabDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed top-4 right-4 z-50 rounded-full bg-blue-600 p-3 text-white shadow-lg transition-colors hover:bg-blue-700"
        aria-label="Toggle panel"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>{children}</DrawerContent>
      </Drawer>
    </>
  );
}
