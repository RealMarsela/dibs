import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/sheet";
import { Input } from "@/components/ui/input";
import { PEOPLE } from "@/data/sample";
import { putName } from "@/live/api";
import { deviceKey } from "@/live/passkey";

/* A passkey account starts as "Friend 9f0d". Its owner names it by signing `dibs-name:v1:<account>:<name>:<ts>` with
   the same key, so only they can; everyone on the trip sees the name on their next refresh. */
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} ]{0,23}$/u;
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export function NameButton({ account, onSaved }: { account: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const clean = name.trim().replace(/\s+/g, " ");

  async function save() {
    if (!NAME_RE.test(clean)) return setErr("Letters and spaces only, up to 24.");
    setBusy(true);
    setErr(null);
    try {
      const key = await deviceKey();
      if (key.accountId !== account) throw new Error("This device is signed in as a different account.");
      const ts = Date.now();
      const sig = await key.sign(new TextEncoder().encode(`dibs-name:v1:${account}:${clean}:${ts}`));
      await putName({ account, name: clean, ts, sig: hex(sig) });
      if (PEOPLE[account]) PEOPLE[account].name = clean;
      onSaved();
      setOpen(false);
      toast("Name saved", { description: "Everyone on the trip sees it from their next refresh." });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t save the name");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="press focus-ring flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-fg-3 hover:bg-white/[0.05] hover:text-fg"
        onClick={() => {
          setName(/^Friend [0-9a-f]{4}$/.test(PEOPLE[account]?.name ?? "") ? "" : (PEOPLE[account]?.name ?? ""));
          setErr(null);
          setOpen(true);
        }}
      >
        <Pencil className="size-3.5" /> Your name
      </button>
      <Sheet open={open} onOpenChange={setOpen} eyebrow="This device" title="What should friends call you?">
        <p className="text-[14.5px] leading-relaxed text-fg-2">Shown next to your bed and in the receipts. Signed with this device’s passkey, so only you can change it.</p>
        <Input className="mt-5" autoFocus maxLength={24} placeholder="Maya" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void save()} />
        {err && <p className="mt-3 rounded-xl bg-refused/10 px-3 py-2 text-[13px] text-refused">{err}</p>}
        <button className="pill-light focus-ring press mt-5 w-full" disabled={busy || !clean} onClick={() => void save()}>
          {busy && <Loader2 className="size-4 animate-spin" />} Save name
        </button>
      </Sheet>
    </>
  );
}
