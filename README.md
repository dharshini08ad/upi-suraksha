# UPI Suraksha — National UPI Payment Verification Service

A frontend prototype and standalone FastAPI backend for a UPI fraud detection platform.
`INPUT → ANALYZE → RISK SCORE → ALERT → ACTION`.

The frontend decodes QR codes in the browser and sends them to the FastAPI backend
for local risk analysis. Payment-link and UPI-ID screens retain their browser rules.

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
python -m uvicorn backend.main:app --reload
```

The API is available at `http://localhost:8000`; interactive endpoint docs are
at `http://localhost:8000/docs`. Check it with `python -m pytest backend/tests`.

`POST /api/analyze/qr` accepts decoded JSON (`{"payload":"upi://pay?..."}`)
or multipart form data with an `image` field. Set `VITE_API_URL` to the backend
origin; the checked-in `.env.development` points local Vite development at
`http://localhost:8000`.
`POST /api/analyze/url` accepts `{"url":"https://..."}`; and
`POST /api/analyze/upi` accepts `{"upi_id":"name@provider"}`. Responses
include `risk_score`, `risk_level`, `detected_threats`, `reasons`,
`recipient_info`, and `recommended_action`. Analysis is local and heuristic;
it does not contact domains, verify account ownership, or process payments.

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
| `/`          | Home — **Secure Every UPI Payment** + running advisory ticker      |
| `/scan`      | QR scanner — **live camera decoding**, upload, paste               |
| `/link`      | Check a payment link                                              |
| `/upi`       | Verify a UPI ID                                                   |
| `/analyse`   | Staged analysis progress                                          |
| `/report`    | Fraud risk score 0–100, the five checks, suspicious indicators    |
| `/decision`  | Alert — *Payment Risk Detected* / *Payment appears safe* + action |

## Live QR scanning

The scanner decodes **live** with `jsQR` on a `requestAnimationFrame` loop
(`src/lib/qr.ts`). When a code is found the camera is stopped and the payload is
analysed automatically. The same decoder handles uploaded images, so it works on
desktops where the native `BarcodeDetector` API is unavailable.

Because the decoder is ~50 kB gzipped, the scan route is lazy-loaded — the first
paint never pays for it.

## Colour system

Razorpay-style navy for authority, with GPay's four accent colours used as
**flat** blocks (no gradients) in a `.chipbar` strip on the masthead, the score
card and the alert:

| Token        | Role                 |
| ------------ | -------------------- |
| `--navy-900` | `#0c2340` authority  |
| `--blue-600` | `#1a73e8` primary    |
| `--ok-600`   | `#12a05c` verified   |
| `--warn-600` | `#e8a400` review     |
| `--risk-600` | `#d93025` blocked    |

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

- **Demo branding.** "UPI Suraksha" and the "National Digital Payments Authority"
  are fictional, and the footer says so. The flag mark and the cybercrime
  helpline number **1930** are real.
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
