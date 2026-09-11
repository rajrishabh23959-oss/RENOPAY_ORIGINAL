# RenoPay — Full Stack Setup

## Folder layout (required for docker-compose)

Unzip both projects as **siblings** under one parent directory:

```
renopay/
├── renopay-backend/     (this project)
└── renopay-frontend/
```

The backend's `docker-compose.yml` builds the frontend from
`../renopay-frontend`, so this layout matters if you're running the
full stack with one command.

## Quick start — full stack

```bash
cd renopay-backend
cp .env.example .env
# fill in JWT_SECRET_KEY and FIELD_ENCRYPTION_KEY (generation commands are in .env.example)
docker compose up
```

This starts Postgres, Redis, the FastAPI backend (migrations run
automatically on boot), and the frontend served via Nginx on port 80.
Backend API docs: `http://localhost:8000/docs`. Frontend:
`http://localhost`.

## Quick start — backend only, for local development

```bash
cd renopay-backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# point DATABASE_URL / SYNC_DATABASE_URL in .env at your own Postgres
alembic upgrade head
uvicorn app.main:app --reload
```

## Quick start — frontend only, for local development

```bash
cd renopay-frontend
npm install
npm run dev
```

Vite's dev server proxies `/api` and `/ws` to `http://localhost:8000`
(see `vite.config.js`), so run the backend alongside it.

## Running tests

Tests need a real Postgres instance — not SQLite — because the
concurrency test exercises actual `SELECT ... FOR UPDATE` row locking.

```bash
cd renopay-backend
createdb renopay_test   # or point TEST_DATABASE_URL at any throwaway DB
pytest -v
```

The suite includes `test_concurrent_payments_cannot_double_spend`,
which fires two simultaneous payments at an account that only has
enough balance for one, and asserts exactly one succeeds and the
balance never goes negative — this is the actual proof the payment
engine's locking works, not just a code-review claim.

`tests/test_sentinai.py` needs no database and runs in milliseconds;
it pins down the exact fraud-scoring rules (geo-velocity, bot-speed
note entry, new-device, blocking thresholds).

## CI

`.github/workflows/backend-ci.yml` and `frontend-ci.yml` run on every
push/PR: ruff lint → pytest against a real `postgres:16` service
container (including the concurrency test) → Docker image build for
the backend; `npm run build` (the real Vite+Tailwind pipeline, not a
syntax check) for the frontend.

## Known follow-ups

- OTP delivery defaults to `SMS_PROVIDER=console` (logs the OTP
  server-side, returned as `debug_otp` in the API response for
  testability). A `TwilioSMSProvider` is implemented in
  `app/services/sms.py` and ready to use — set `SMS_PROVIDER=twilio`
  and fill in `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` /
  `TWILIO_FROM_NUMBER` in `.env`, and `pip install twilio` (not in
  requirements.txt by default since most local/demo setups won't need
  it). Once a real provider is active, `debug_otp` stops being
  returned automatically.

### Closed this phase (PIN audit)
- Extracted PIN verification + lockout into a single shared helper
  (`app/services/pin_auth.py`), used by the payment engine AND every
  other endpoint that debits a real balance or authorizes a standing
  future debit: savings goal contributions, shared vault
  contributions, UPI Lite top-up, and mandate (AutoPay) creation.
  Previously only `/payments/send` and `/requests/{id}/pay` checked a
  PIN — the other four moved money with nothing but a valid JWT.
- Built the `VaultScreen` frontend, which didn't exist before despite
  the backend `vaults` router being fully implemented — reachable from
  Savings Goals → "Shared Vaults →".

### Closed previous phase
- Live camera QR scanning (`ScanScreen`) now uses `jsqr` +
  `getUserMedia` for real detection, with graceful fallback to manual
  VPA entry when camera permission is denied or unsupported.
  `QRScreen` generates real QR codes via the `qrcode` package instead
  of a pseudo-random visual placeholder.
- The monthly budget is now a per-account `monthly_budget_paise`
  column (migration `0002_account_budget`), editable from the Profile
  screen, instead of a hardcoded global constant.
