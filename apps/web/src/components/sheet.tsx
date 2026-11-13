import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/* Bottom sheet on phones, centred card from md up. Radix handles focus trap, Esc and scroll lock. */
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
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_180ms_ease-out] data-[state=closed]:animate-[fade-out_140ms_ease-in]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[22px] border border-rule bg-card px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_-20px_#1e1b1666] outline-none data-[state=open]:animate-[sheet-up_320ms_var(--ease-out-strong)] data-[state=closed]:animate-[sheet-down_200ms_ease-in] md:inset-auto md:left-1/2 md:top-1/2 md:w-[460px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[22px] md:px-7 md:pb-7 md:pt-6 md:data-[state=open]:animate-[pop-in_220ms_var(--ease-out-strong)]"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-rule md:hidden" />
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
              <Dialog.Title className="text-[22px] font-bold leading-tight tracking-[-0.02em]">{title}</Dialog.Title>
            </div>
            <Dialog.Close className="focus-ring -mr-1 rounded-full p-2 text-ink-soft hover:bg-paper-deep" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
