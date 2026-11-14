# Dibs film: footage requests

Drop each clip at `film/public/footage/<slot-id>.mp4` (gitignored). The film picks it up on the next render;
until then each slot shows an on-brand placeholder rebuilt from the app's components. Nothing else changes.

**Spec for every clip:** the live app as it will ship (dark theme), 1920 x 1080 CSS viewport at deviceScaleFactor 2
(so the file is 3840 x 2160, or at least 2560 x 1440), 30 or 60 fps, H.264; no browser chrome, no notifications,
no real personal data; slow deliberate cursor (visible, default arrow); hold **1 s still at the start and the end**;
one action per clip. Trip `lis0312` unless noted. Record the dialog (Sheet) at its desktop size (440 px wide, centred):
the film crops and zooms into it, so keep the page scroll still while a sheet is open.

Timing note: the film plays each clip at 1x from the `startFrom` offset noted below; if a step in your recording takes
longer, tell me the second marks (I re-time with `startFrom`/`playbackRate`, a one-line change).

| Slot | Seconds | Route | Exact clicks and typing, in order | Start state | End state | Used in the film |
|---|---|---|---|---|---|---|
| `pay-base` | 16 | `/t/lis0312` | 1. "Preview as" **Leo** (or the live viewer for Leo). 2. Click **Pay $40** on bed 03. 3. In the sheet: **Hold bed 03 with a passkey** (passkey prompt done off-camera or skipped). 4. Select **Base** in "Pay from any chain". 5. **Get my Base address**. 6. **I've sent it** (or wait for the live deposit). 7. Let the four tracking steps tick: Deposit seen on your chain / Swapped by NEAR Intents / Landed in your bed's own account / Counted in the crew DAO. 8. Hold on "You're in". | Trip page, bed 03 Held (orange "Held, not paid yet"), 7 of 8 paid | Sheet "You're in", 4 steps checked | S03, 0:21-0:31 (passkey at 0:21, Base selected by 0:28, steps ticking 0:28-0:31) |
| `mainnet-receipt` | 6 | the mainnet tx page for Leo's real payment (nearblocks.io mainnet, or the app's receipt link) | No clicks: open the tx page scrolled so status **Success**, from, to (bed 03's account) and the USDC amount are all visible; hold still; optionally a slow 1 s scroll. | Tx page loaded | Same | **Variant A only** (the cut uses variant B, the testnet line, until Gabriel approves and runs mainnet). S03, 0:32.5-0:36, cropped on the summary block. |
| `resale` | 9 | `/t/lis0312` | 1. Preview as **Ana**. 2. Click **Can't make it?** on bed 04. 3. Click **Get my $40 back**. 4. Hold on the Refused card ("Refunds don't exist in this trip ...", E_NO_REFUND if the live sheet shows it) for 3 s. | Trip page, Ana's bed 04 Paid | Sheet showing Refused | S04, 0:41.4-0:45.7 |
| `card` | 18 | `/t/lis0312` (or the card demo trip) | 1. Preview as **Maya** after every bed is paid. 2. Open the card sheet (**Book it with the trip's own card** / **Issue the trip's card**). 3. Let the four issuing steps tick. 4. Card appears. 5. Click **Carlton City Hotel SG** -> Approved. 6. Click **VoltCity Electronics** -> Declined. Hold 2 s. | NextStep shows the card CTA | "Try it" rows: Approved, Declined | S06, 1:13.4-1:18.4 (we use only the "Try it" part: set its start second in your note) |
| `proof` | 18 | `/t/sin1025` (the REAL booking; v2) | 1. Preview as **Maya**. 2. Open the proof sheet; the inbox item "Booking email from booking.com" is listed. 3. Click it (**Check**). 4. Four checks tick. 5. Facts card "What every friend sees" (booking.com, dates, guests, total, Hidden: ...). 6. The green "The crew DAO paid Maya ..." line with the receipt link. Hold 3 s. | Proof sheet, upload step with the inbox address | Facts + DAO paid line | S07, 1:41.4-1:44 (we use the facts + DAO paid part: set its start second in your note) |
| `forged` (optional) | 6 | proof sheet | Upload the tampered `.eml` (test fixture) and hold on "The contract refused this proof: E_NO_RESULT. Nothing moved." | Proof sheet upload step | Refused panel | S08, 1:47-1:49 (small window) |

When a clip lands: tell me the slot id and, for `card` and `proof`, the second where the used part starts.
