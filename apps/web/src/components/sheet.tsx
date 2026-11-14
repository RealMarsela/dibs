import { useEffect, useState, type ReactNode } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function useWide(): boolean {
  const q = "(min-width: 768px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

/* NEAR Connect draws its wallet picker on <body>, outside the sheet. Clicks and Escape inside it belong to the picker:
   the sheet must neither close on them nor swallow them (see .hot-connector-popup in index.css). */
const PICKER = ".hot-connector-popup";
const keepForPicker = (e: { target: EventTarget | null; preventDefault(): void }) => {
  if ((e.target as Element | null)?.closest?.(PICKER)) e.preventDefault();
};
const escapeForPicker = (e: KeyboardEvent) => {
  if (document.querySelector(PICKER)) e.preventDefault();
};

/* shadcn Drawer (vaul) on phones, shadcn Dialog from md up. Both wear the frosted glass surface. */
export function Sheet({
  open,
  onOpenChange,
  title,
  eyebrow,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  const wide = useWide();
  const head = (
    <>
      {eyebrow && <p className="label mb-1">{eyebrow}</p>}
    </>
  );
  if (wide)
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass max-w-[440px] gap-0 rounded-[28px] border-line p-7 text-fg sm:max-w-[440px]" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={keepForPicker} onEscapeKeyDown={escapeForPicker}>
          <DialogHeader className="mb-5 text-left">
            {head}
            <DialogTitle className="display text-[24px] text-fg">{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="glass rounded-t-[28px] rounded-b-none border-line px-5 pb-[max(20px,env(safe-area-inset-bottom))] text-fg" onInteractOutside={keepForPicker} onEscapeKeyDown={escapeForPicker}>
        <DrawerHeader className="px-0 pb-4 pt-3 text-left">
          {head}
          <DrawerTitle className="display text-[24px] text-fg">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{title}</DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[70dvh] overflow-y-auto pb-2">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
