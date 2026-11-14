import React from "react";
import { C, FONT, GLASS, PEOPLE, type PersonId } from "../../tokens";
import { Face } from "../../components/LetterFace";

/* A chat bubble in Dibs glass: frosted warm grey, hairline, radius 28. Sender name small and grey above the message
   (30 px, weight 500, warm off-white). Replies carry the sender's letter face (44 px) on the left. */
export function ChatBubble({ from, face = true, children }: { from: PersonId; face?: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        ...GLASS,
        borderRadius: 28,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: face ? "15px 30px 17px 17px" : "17px 32px 20px 32px",
        whiteSpace: "nowrap",
      }}
    >
      {face && <Face id={from} size={44} />}
      <div style={{ fontFamily: FONT }}>
        <div style={{ fontSize: 20, fontWeight: 500, color: C.fg2, lineHeight: 1.25, letterSpacing: "-0.005em" }}>{PEOPLE[from].name}</div>
        <div style={{ fontSize: 30, fontWeight: 500, color: C.fg, lineHeight: 1.24, letterSpacing: "-0.012em" }}>{children}</div>
      </div>
    </div>
  );
}

/** Centre a child at film (x, y) inside the camera layer, with an extra transform/filter/opacity. */
export function Place({ x, y, transform = "", opacity = 1, filter, children }: {
  x: number; y: number; transform?: string; opacity?: number; filter?: string; children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) ${transform}`,
        opacity,
        filter,
      }}
    >
      {children}
    </div>
  );
}
