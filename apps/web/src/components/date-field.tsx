import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

/* A designed date picker (shadcn Calendar in a Popover), in place of the browser's native date input. */
export function DateField({ value, onChange, min, label }: { value?: Date; onChange: (d: Date) => void; min?: Date; label: string }) {
  const [open, setOpen] = useState(false);
  const text = value ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(value) : "Pick a date";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "press focus-ring flex h-12 w-full items-center gap-2.5 rounded-2xl border border-line bg-white/[0.04] px-4 text-left text-[15.5px] transition-colors hover:bg-white/[0.06]",
            !value && "text-fg-3",
          )}
        >
          <CalendarDays className="size-4 text-fg-2" />
          {text}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="glass w-auto border-line p-2 text-fg">
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value ?? min}
          disabled={min ? { before: min } : undefined}
          onSelect={(d) => {
            if (d) {
              onChange(d);
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
