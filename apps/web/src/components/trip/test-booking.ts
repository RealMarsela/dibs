/* A TEST booking confirmation for a trip, so someone without a real booking can still run the proof and payout on
   their own testnet trip. It is DKIM-signed for the fixture domain `dibs-test.example`, whose private key is
   published in this repo (outlayer/verifier/tests/fixtures) and which only the testnet verifier build accepts. The
   mainnet verifier never trusts it. Real proofs come from booking.com, airbnb.com or hostelworld.com. */
import pem from "../../../../../outlayer/verifier/tests/fixtures/dibs_test_dkim_key.pem?raw";

const DOMAIN = "dibs-test.example";
const SELECTOR = "dibs-test";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const longDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const relaxed = (name: string, value: string) => `${name.toLowerCase()}:${value.replace(/\r\n/g, "").trim().split(/\s+/).join(" ")}\r\n`;

async function key(): Promise<CryptoKey> {
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

export async function testBookingEml(t: { code: string; place: string; stay: string; checkIn: string; checkOut: string; guests: number; total: number }): Promise<File> {
  const ref = String(Math.floor(1e9 + Math.random() * 9e9));
  const body =
    `Your booking is confirmed!\r\n${t.stay}, ${t.place}\r\nConfirmation number: ${ref}\r\n` +
    `Check-in: ${longDate(t.checkIn)}\r\nCheck-out: ${longDate(t.checkOut)}\r\nGuests: ${t.guests} adults\r\nTotal price: USD ${t.total.toFixed(2)}\r\n`;
  const h: [string, string][] = [
    ["From", `Reservations <noreply@${DOMAIN}>`],
    ["To", `${t.code}@dibs.larinova.com`],
    ["Subject", `Booking confirmation for ${t.stay}`],
    ["Date", new Date().toUTCString().replace("GMT", "+0000")],
    ["Message-ID", `<${t.code}${ref}@${DOMAIN}>`],
  ];
  const bh = b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)));
  const sigHdr = `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${DOMAIN}; s=${SELECTOR}; h=from:to:subject:date:message-id; bh=${bh}; b=`;
  const signed = h.map(([n, v]) => relaxed(n, v)).join("") + relaxed("DKIM-Signature", sigHdr).replace(/\r\n$/, "");
  const sig = b64(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await key(), new TextEncoder().encode(signed)));
  const headers = h.map(([n, v]) => `${n}: ${v}\r\n`).join("") + "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n";
  const eml = `DKIM-Signature: ${sigHdr}${sig}\r\n${headers}\r\n${body}`;
  return new File([eml], `test-booking-${t.code}.eml`, { type: "message/rfc822" });
}
