# RenoPay — Full-Stack AI-First UPI Super-App

[![Backend CI](https://github.com/renopay/renopay/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/renopay/renopay/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/renopay/renopay/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/renopay/renopay/actions/workflows/frontend-ci.yml)
[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

**RenoPay** is a production-grade full-stack UPI payment super-app and financial operating system. It features real-time payment settlement, AI-driven fraud detection (**SentinAI**), interactive tactile note-slider payments, on-device Voice UPI, UPI Lite, micro-investment into Digital Gold, shared savings vaults, AutoPay recurring mandates, and an enterprise double-entry accounting engine with downloadable PDF statements.

---

## Architecture & Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite 5, Tailwind CSS, Lucide Icons, Axios, WebSockets, HTML5 Web Speech API |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0 (Async), Alembic, Pydantic v2, APScheduler |
| **Databases & Cache** | PostgreSQL 16 (production) / SQLite via `aiosqlite` (zero-setup dev), Redis 7 |
| **Reporting & Security**| ReportLab & xhtml2pdf (PDF reports), Cryptography (Fernet PII encryption, bcrypt/Argon2 PIN hashing, JWT) |
| **Mobile** | Capacitor Android shell (`andriod/` directory) |
| **DevOps & Deploy** | Docker, Docker Compose, Nginx unprivileged reverse proxy, GitHub Actions CI |

---

## Key Features

1. **SentinAI Fraud Protection Engine**:
   - Multi-factor risk scoring analyzing transaction velocity, impossible geo-travel (Haversine formula), bot-speed note entry, odd-hour activity, and high-value transfers.
   - Real-time blocking and step-up authentication.
2. **Interactive Note Slider**:
   - Tactile, physics-based payment interface with authentic Indian rupee denominations (₹10, ₹20, ₹50, ₹100, ₹200, ₹500 and coins ₹1, ₹2, ₹5) with audio feedback and drag gestures.
3. **UPI Lite & Micro-Payments**:
   - PIN-less instant wallet for transactions up to ₹500, with balance caps and top-ups.
4. **Voice UPI**:
   - On-device speech recognition via Web Speech API with NLP intent extraction for hands-free payments.
5. **Round-Up Digital Gold**:
   - Automated micro-investing rounding up daily transactions to purchase digital gold 24K.
6. **Shared Savings Vaults & Goals**:
   - Goal-based savings with progress milestones and collaborative group vaults with member contributions.
7. **AutoPay Recurring Mandates**:
   - Subscription management and scheduled recurring mandates with auto-execution via APScheduler.
8. **Live QR Code Scanner & Generator**:
   - Dynamic UPI QR generator and live camera feed scanner powered by `jsqr` with automatic camera fallback.
9. **Double-Entry Accounting & PDF Reports**:
   - Full GAAP-compliant journal entries, trial balances, balance sheets, and audit-ready PDF receipt & statement generation.
10. **Real-Time Push Updates**:
    - Persistent WebSocket connections pushing live balances, incoming payment alerts, and fraud notifications.

---

## Repository Structure

```text
renopay-fullstack-complete/
├── docker-compose.yml              # Root Docker Compose (Postgres, Redis, API, Web)
├── readme.md                       # Main project documentation & deployment guide
├── andriod/                        # Capacitor Android mobile wrapper
│   ├── capacitor.config.json       # App configuration (com.rishabh.renopay)
│   └── android/                    # Android Studio native project
├── renopay-backend/                # FastAPI Backend Application
│   ├── Dockerfile                  # Python 3.12 slim container
│   ├── .dockerignore               # Optimized Docker build context
│   ├── .env.example                # Environment variable specification template
│   ├── requirements.txt            # Python production dependencies
│   ├── pytest.ini                  # Pytest async configuration
│   ├── alembic.ini                 # Database migration settings
│   ├── alembic/                    # Database migrations (0001 to 0007)
│   ├── app/
│   │   ├── main.py                 # FastAPI application factory & lifespan
│   │   ├── core/                   # Security, Fernet crypto, config, money math
│   │   ├── db/                     # SQLAlchemy async session & base models
│   │   ├── models/                 # ORM entities (users, accounts, txns, vaults, etc.)
│   │   ├── schemas/                # Pydantic v2 validation models
│   │   ├── routers/                # REST & WebSocket API endpoints
│   │   └── services/               # SentinAI, payment engine, accounting, PIN auth
│   └── tests/                      # 33 unit & integration tests
└── renopay-frontend/               # React 18 + Vite Frontend Application
    ├── Dockerfile                  # Multi-stage build (Node 22 -> Nginx Alpine)
    ├── nginx.conf                  # Production reverse proxy & security headers
    ├── package.json                # React dependencies and scripts
    ├── tailwind.config.js          # RenoPay design tokens & color palette
    ├── vite.config.js              # Vite dev server proxy configuration
    └── src/
        ├── App.jsx                 # Routing & shell container
        ├── screens/                # All 18 application screens
        ├── components/             # NoteSlider, BottomNav, QuickSend, etc.
        ├── context/                # AuthContext, NotificationContext
        ├── hooks/                  # useRenoSocket, useDebounce, etc.
        └── lib/                    # Axios API client, currency formatting
```

---

## Quick Start — Local Development

### Prerequisites
- **Node.js**: v18.0 or higher
- **Python**: v3.12 or higher

### 1. Backend Setup (Zero-Configuration SQLite)
By default, RenoPay uses SQLite for immediate local development without requiring Docker or PostgreSQL.

```bash
cd renopay-backend

# 1. Create and activate virtual environment
python -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env

# Generate secret keys and paste them into your .env:
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(64))"
python -c "from cryptography.fernet import Fernet; print('FIELD_ENCRYPTION_KEY=' + Fernet.generate_key().decode())"

# 4. Run the server
uvicorn app.main:app --reload --port 8000
```
- API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

### 2. Frontend Setup

```bash
cd renopay-frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
- Open [http://localhost:5173](http://localhost:5173) in your browser.
- Vite automatically proxies `/api` and `/ws` to `http://localhost:8000`.

### Default Demo Credentials
On startup, demo accounts are automatically seeded:
| User | Phone Number | UPI PIN | Default VPA |
|---|---|---|---|
| **Rishab Raj** | `9876543210` | `123456` | `rishab@renopay` |
| **Alex Morgan** | `9876543211` | `123456` | `alex@renopay` |

---

## Quick Start — Single-Command Docker Compose

To run the entire full stack (PostgreSQL 16, Redis 7, FastAPI backend, and Nginx-served frontend) with one command from the project root:

```bash
# Ensure renopay-backend/.env exists with valid keys
docker compose up --build
```

- **Frontend Application**: [http://localhost](http://localhost) (port 80)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Testing & Quality Assurance

The codebase includes an extensive test suite covering core payment correctness, double-spend prevention, fraud rules, and accounting reconciliation.

### Running Backend Tests
```bash
cd renopay-backend
pytest -v
```
All 33 test suites pass out of the box:
- `tests/test_payment_engine.py`: Atomic debit/credit, balance validation, round-ups.
- `tests/test_sentinai.py`: Geolocation velocity, bot detection, odd-hour heuristics.
- `tests/test_pin_auth.py`: PIN verification, progressive rate-limiting & 15-minute lockouts.
- `tests/test_accounting_engine.py`: Double-entry journal posting, chart of accounts, trial balance.
- `tests/test_pdf_reports.py`: Dynamic receipt and financial report generation.
- `tests/test_mandates.py` & `test_rewards.py`: AutoPay lifecycle, scratch card redemption.

### Running Linters
```bash
# Backend linter (Ruff)
cd renopay-backend
ruff check app tests

# Frontend production build validation
cd renopay-frontend
npm run build
```

---

## Deployment Readiness Assessment

### Current Status: **READY FOR DEPLOYMENT**

All core services, database migrations, security controls, Docker definitions, and front/backend build pipelines have been audited and verified.

### Pre-Deployment Checklist

| Area | Requirement | Status | Action Required Before Prod |
|---|---|---|---|
| **Secrets & Keys** | Strong `JWT_SECRET_KEY` & `FIELD_ENCRYPTION_KEY` | ✅ Enforced | Generate via `secrets.token_urlsafe(64)` and Fernet key generator. Backend rejects placeholder values when `ENV!=development`. |
| **Environment** | `ENV=production`, `DEBUG=false` | ✅ Enforced | Set `DEBUG=false` in production environment. |
| **Database** | PostgreSQL 16 + AsyncPG | ✅ Ready | Set `DATABASE_URL=postgresql+asyncpg://...` and `SYNC_DATABASE_URL=postgresql+psycopg2://...`. Migrations apply via `alembic upgrade head`. |
| **Cache & Lockout** | Redis | ✅ Ready | Set `REDIS_URL=redis://...`. Used for OTP throttling and PIN attempt lockout. |
| **CORS Origins** | Allowed domains | ✅ Ready | Set `CORS_ORIGINS` to your production frontend domain (e.g. `["https://app.renopay.com"]` or comma-separated). |
| **SMS Delivery** | OTP SMS Delivery | ⚠️ Configurable | Defaults to `SMS_PROVIDER=console`. For real SMS, set `SMS_PROVIDER=twilio` and configure Twilio credentials. |
| **Nginx & HTTPS** | SSL / TLS & Permissions-Policy | ✅ Ready | Nginx allows `camera=(self), microphone=(self)` for QR scanning and Voice UPI. Terminate SSL at load balancer/Cloudflare or add certbot. |
| **Frontend Config** | API Base URL | ✅ Ready | Defaults to `/api` for unified reverse proxies (Docker/Nginx), or customize via `VITE_API_BASE_URL` and `VITE_WS_URL` for decoupled hosting (Vercel + Railway). |

---

## Deployment Guides

### Option A: Deploy with Docker Compose (VPS / AWS EC2 / DigitalOcean)
1. Clone the repository onto your server.
2. Create `renopay-backend/.env` with your production secrets:
   ```env
   ENV=production
   DEBUG=false
   POSTGRES_USER=renopay_user
   POSTGRES_PASSWORD=your_strong_db_password
   POSTGRES_DB=renopay_prod
   JWT_SECRET_KEY=<generated-64-byte-token>
   FIELD_ENCRYPTION_KEY=<generated-fernet-key>
   CORS_ORIGINS=["https://yourdomain.com"]
   ```
3. Run `docker compose -f docker-compose.yml up -d --build`.
4. Point your domain's DNS to the server IP and configure SSL with Certbot or Cloudflare.

### Option B: Decoupled Cloud Deployment (Railway / Render + Vercel)
1. **Backend (Railway or Render)**:
   - Attach a PostgreSQL and Redis instance.
   - Build using `renopay-backend/Dockerfile` or standard Python 3.12 environment (`pip install -r requirements.txt`).
   - Add environment variables (`DATABASE_URL`, `SYNC_DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, `FIELD_ENCRYPTION_KEY`, `CORS_ORIGINS`).
   - Start Command: `sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"`
2. **Frontend (Vercel / Cloudflare Pages / Netlify)**:
   - Root directory: `renopay-frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variables:
     - `VITE_API_BASE_URL`: `https://your-backend-api.railway.app`
     - `VITE_WS_URL`: `wss://your-backend-api.railway.app/ws`

### Option C: Mobile APK Build (Android)
The repository includes a ready-to-build Capacitor configuration:
```bash
# 1. Build the frontend web bundle
cd renopay-frontend
npm run build

# 2. Copy dist to Android web assets
cp -r dist/* ../andriod/www/

# 3. Open in Android Studio
cd ../andriod
npx cap sync
npx cap open android
```
Build your signed APK or Android App Bundle (.aab) directly in Android Studio.

---

## License
MIT License. Built with ❤️ for next-generation digital payments.
