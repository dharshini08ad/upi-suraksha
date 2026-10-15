# UPI Suraksha — Simulated UPI Wallet and Safety Checks

An existing React/Vite frontend and FastAPI backend for simulated payments and local UPI risk checks. It does not connect to a bank or move real money.

The frontend decodes QR codes in the browser and sends QR, UPI ID, URL, and payment
analysis to the Python backend. Offline fallback results are labelled as local
pattern checks. The simulator persists wallet balances, contacts, transactions,
and fraud evidence per authenticated user.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle into dist/
npm run check      # typecheck + score report + render smoke test
```

## Run the API

```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload
```

The API is available at `http://127.0.0.1:8001`; interactive endpoint docs are
at `http://127.0.0.1:8001/docs`. New demo accounts start with ₹50,000 simulated
funds. Check it with `python -m pytest backend/tests`.

`POST /api/analyze/qr` accepts decoded JSON (`{"payload":"upi://pay?..."}`)
or multipart form data with an `image` field. Set `VITE_API_URL` to the backend
origin; the checked-in `.env.development` points local Vite development at
`http://127.0.0.1:8001`.
`POST /api/analyze/url` accepts `{"url":"https://..."}`; and
`POST /api/analyze/upi` accepts `{"upi_id":"name@provider"}`. Responses
include `risk_score`, `risk_level`, `detected_threats`, `reasons`,
`recipient_info`, and `recommended_action`. Analysis uses local heuristics; it
does not contact domains or verify account ownership. `/api/payments` processes
simulated transfers only, with server-side validation, atomic debits, idempotency,
and explicit confirmation for medium-risk requests.

## Deploy

**Vercel frontend:** Import this repository, use the root directory `.`, build
command `npm run build`, and output directory `dist`. `vercel.json` contains
these settings and the SPA rewrite required for direct navigation to `/scan`.
Set `VITE_API_URL` to the deployed Render service origin, for example
`https://upi-suraksha-api.onrender.com` (without a trailing slash).

**Render backend:** Create a Blueprint from `render.yaml`, or create a Python web
service with root directory `.`, build command
`pip install -r backend/requirements.txt`, and start command
`uvicorn backend.main:app --host 0.0.0.0 --port $PORT`. Set `ENVIRONMENT` to
`production` and `CORS_ORIGINS` to the exact Vercel production origin, for example
`https://upi-suraksha.vercel.app`. Add any extra trusted origins as a
comma-separated list; wildcard CORS is rejected.

Analysis screens fall back to clearly labelled local pattern checks if the API
URL is missing or unreachable. Simulated payments require the configured API.
Set `VITE_API_URL` in Vercel and redeploy to use the hosted backend. Camera
access on a phone requires HTTPS; use the deployed HTTPS site rather than the
Vite server's plain-HTTP LAN address.

`VITE_API_URL` is a public frontend build-time URL, not a secret. Do not place
API keys or credentials in Vite environment variables. `.env.example` lists the
local values; configure production values in the Vercel and Render dashboards.

## Branding

Every piece of brand copy lives in **`src/lib/brand.ts`** — edit that one file
to rename the service; everything else follows.

Current name: **UPI Suraksha** (सुरक्षा). Other easy swaps if you want a
different one: *UPI Vishwas* (विश्वास, trust), *UPI Rakshak*, *Pay Suraksha*.

## The flow

| Route        | Screen                                                            |
| ------------ | ----------------------------------------------------------------- |
| `/`          | Home — simulated balance, saved contacts, Pay and Scan QR          |
| `/wallet`    | Simulated balance and recent activity                              |
| `/scan`      | QR scanner — **live camera decoding**, upload, paste               |
| `/history`   | Persisted simulated transactions and fraud evidence                |
| `/link`      | Check a payment link                                              |
| `/upi`       | Verify a UPI ID                                                   |
| `/analyse`   | Staged analysis progress                                          |
| `/report`    | Fraud risk score 0–100, the five checks, suspicious indicators    |
| `/decision`  | Risk alert and recommended action                                  |

## Live QR scanning

The scanner decodes **live** with `jsQR` on a `requestAnimationFrame` loop
(`src/lib/qr.ts`). When a code is found the camera is stopped and the payload is
analysed automatically. The same decoder handles uploaded images, so it works on
desktops where the native `BarcodeDetector` API is unavailable. When the API is
not reachable, browser-side results are labelled as heuristics and do not verify
account ownership or guarantee that a payment is safe.

Because the decoder is ~50 kB gzipped, the scan route is lazy-loaded — the first
paint never pays for it.

## Colour system

A bright, premium light theme with **glassmorphism** cards (translucent white,
backdrop blur, soft gradients and rounded corners), inspired by Google Pay's
calm, trustworthy feel. The base is pastel sky blue, mint green, soft white and
very light grey — there are no dark backgrounds. Saffron, white and green
tricolour accents appear only as small highlights, decorative gradients and
security indicators, and the flag colours are re-used as the risk scale (green
= safe, amber = verify, red = blocked):

| Token             | Role                                      |
| ----------------- | ----------------------------------------- |
| `--navy-900`      | `#14385f` headings / strong text          |
| `--blue-600`      | `#1a73e8` primary actions                |
| `--ok-600`        | `#12a05c` verified / low risk            |
| `--warn-600`      | `#e8a400` review / medium risk           |
| `--risk-600`      | `#d93025` blocked / high risk            |
| `--flag-saffron`  | `#ff9933` Indian identity accent         |
| `--flag-green`    | `#138808` Indian identity accent         |

## How the score is produced

`src/lib/parse.ts` normalises whatever the user submits into one record: it
parses `upi://pay?pa=…&pn=…&am=…&cu=INR` intents, payment URLs (including links
that bury the intent in a redirect or in the path) and bare VPAs.

`src/lib/riskEngine.ts` scores that record across five categories and returns a
0–100 score with the findings that produced it. The engine is deterministic —
the same input always returns the same score.

| Category             | Examples of what it catches                                        |
| -------------------- | ----------------------------------------------------------------- |
| Recipient verification | Payee name claiming to be a regulator; name/handle mismatch       |
| UPI ID verification    | Keyword-stuffed handles, numeric handles, unregistered payees     |
| QR authenticity        | Truncated or non-native payloads, missing merchant codes          |
| URL / domain safety    | IP hosts, punycode, homoglyphs, shorteners, high-risk TLDs        |
| Transaction context    | ₹1 bait amounts, notes asking for a PIN/OTP, generic notes        |

Bands: **LOW 0–24 → Allow**, **MEDIUM 25–59 → Verify**, **HIGH 60–100 → Block**.

## Sample data

`src/data/samples.ts` holds nine realistic payloads used by the demo buttons on
each input screen. `npm run scorecheck` prints the score each one receives:

```
Neighbourhood retailer QR    LOW      12/100
Gadget store counter QR      LOW       0/100
Fuel bill payment link       LOW      22/100
Wholesale trader link        MEDIUM   58/100
Canteen top-up QR            MEDIUM   33/100
Salary credit notice         MEDIUM   30/100
Account KYC pending QR       HIGH     91/100
Refund collection link       HIGH    100/100
Prize claim UPI ID           HIGH     70/100
```

## Notes and limitations

- **No identity provider.** Phone and UPI ownership lookups are not configured;
  saved contacts and sample merchants are not identity verification.
- **Demo branding.** UPI Suraksha is an independent demonstration, not a
  Government of India service. Payments and wallet balances are simulated.
- **Camera access needs a secure context.** `getUserMedia` only works on
  `localhost` or over HTTPS. Opening `dist/index.html` from `file://` will not
  start the camera — use `npm run dev` or `npm run preview`.
- **The ruleset is offline.** There is no live directory of registered
  merchants, no domain-age lookup and no threat-intel feed, so the reference
  lists in `src/lib/knowledge.ts` are deliberately small and static.

## Layout

```
src/
  components/   chrome, dial, check list, ticker, icons, flag
  lib/          brand, types, knowledge, parse, riskEngine, qr
  screens/      one file per route
  state/        session context (payload + analysis)
  styles/       tokens, base, chrome, components, screens
scripts/        score report + render smoke test
```
