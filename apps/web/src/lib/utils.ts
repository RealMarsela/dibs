import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function usd(n: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** "Fri 20 Nov, 18:00 IST" in the viewer's own zone. */
export function localDeadline(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" }).format(d);
  return `${day}, ${time}`;
}

export function countdown(iso: string, now = Date.now()): string {
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function stayDates(checkIn: string, checkOut: string): { label: string; nights: number } {
  const a = new Date(`${checkIn}T12:00:00`);
  const b = new Date(`${checkOut}T12:00:00`);
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
  const nights = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return { label: `${fmt.format(a)} – ${fmt.format(b)}`, nights };
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
