// Byte-exact extraction of a message/rfc822 part. postal-mime normalizes line endings of 7bit parts,
// which would change the bytes the DKIM body hash and eml_sha256 cover, so the original is cut out by hand.

const bin = (b: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
};
const unbin = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0));

function split(s: string): { head: string; body: string } {
  if (s.startsWith("\r\n")) return { head: "", body: s.slice(2) };
  if (s.startsWith("\n")) return { head: "", body: s.slice(1) };
  const m = /\r?\n\r?\n/.exec(s);
  return m ? { head: s.slice(0, m.index), body: s.slice(m.index + m[0].length) } : { head: s, body: "" };
}

const header = (head: string, name: string): string | undefined => {
  const unfolded = head.replace(/\r?\n[ \t]+/g, " ");
  const m = new RegExp(`^${name}:[ \\t]*(.*)$`, "im").exec(unfolded);
  return m?.[1];
};

function decodeBody(body: string, cte: string | undefined): string {
  const enc = (cte ?? "7bit").trim().toLowerCase();
  if (enc === "base64") return bin(Uint8Array.from(atob(body.replace(/[^A-Za-z0-9+/=]/g, "")), (c) => c.charCodeAt(0)));
  if (enc === "quoted-printable") return body.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return body; // 7bit, 8bit, binary: untouched
}

function parts(body: string, boundary: string): string[] {
  const delim = `\n--${boundary}`;
  const text = `\n${body}`;
  const out: string[] = [];
  let at = text.indexOf(delim);
  while (at >= 0) {
    const lineEnd = text.indexOf("\n", at + delim.length);
    if (lineEnd < 0 || text.startsWith("--", at + delim.length)) break; // closing delimiter
    const next = text.indexOf(delim, lineEnd);
    let end = next < 0 ? text.length : next;
    if (text[end - 1] === "\r") end--;
    out.push(text.slice(lineEnd + 1, end));
    at = next;
  }
  return out;
}

function find(s: string, depth: number): string | undefined {
  const { head, body } = split(s);
  const ct = header(head, "content-type") ?? "";
  if (depth > 0 && /^message\/rfc822/i.test(ct)) return decodeBody(body, header(head, "content-transfer-encoding"));
  const b = /multipart\/[^;]+;.*boundary="?([^";\s]+)"?/i.exec(ct);
  if (!b || depth > 3) return undefined;
  for (const p of parts(body, b[1])) {
    const r = find(p, depth + 1);
    if (r !== undefined) return r;
  }
  return undefined;
}

/** The first message/rfc822 part of a multipart message, as its original bytes; undefined when there is none. */
export function innerRfc822(raw: Uint8Array): Uint8Array | undefined {
  try {
    const r = find(bin(raw), 0);
    return r && r.length > 0 ? unbin(r) : undefined;
  } catch {
    return undefined;
  }
}
