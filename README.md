<div align="center">

# 🚀 RenoPay

### India's Most Advanced Full-Stack UPI Payment Super-App

**Built by Rishabh Raj** · Full-Stack Fintech Platform · 25+ Features · Production-Ready

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)

</div>

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Tech Stack](#-tech-stack)
3. [Architecture](#-architecture)
4. [Core Payment Features](#-core-payment-features)
5. [Security & Fraud Detection — SentinAI](#-security--fraud-detection-sentinai)
6. [Savings & Investment Features](#-savings--investment-features)
7. [Travel & Booking System](#-travel--booking-system)
8. [Bills, Recharges & Financial Services](#-bills-recharges--financial-services)
9. [Gift Cards & Vouchers](#-gift-cards--vouchers)
10. [Double-Entry Accounting Engine](#-double-entry-accounting-engine)
11. [Saathi AI Assistant](#-saathi-ai-assistant)
12. [Expense Analytics & PDF Reports](#-expense-analytics--pdf-reports)
13. [Rewards & Gamification](#-rewards--gamification)
14. [Digital Gold](#-digital-gold)
15. [UPI Lite — Pinless Wallet](#-upi-lite-pinless-wallet)
16. [Real-Time Features — WebSocket](#-real-time-features-websocket)
17. [UI/UX & Theme System](#-uiux--theme-system)
18. [Backend Infrastructure](#-backend-infrastructure)
19. [API Reference Summary](#-api-reference-summary)
20. [Database Schema](#-database-schema)
21. [Deployment](#-deployment)
22. [Running Locally](#-running-locally)

---

## 🌟 Project Overview

**RenoPay** is a production-grade full-stack UPI payment super-app built entirely from scratch by **Rishabh Raj**. It goes far beyond a basic payments app to deliver a complete financial ecosystem spanning payments, savings, investments, travel booking, AI assistance, double-entry accounting, fraud detection, and more.

### What Makes RenoPay Special

| Dimension | Details |
|---|---|
| **Scale** | 25+ distinct feature screens, 20+ REST API routers, 15+ database models |
| **Security** | SentinAI server-side fraud engine with 6 independent risk signals |
| **AI** | Saathi — multilingual AI assistant in 5 Indian languages |
| **Accounting** | Full double-entry bookkeeping: journal, ledger, trial balance, P&L, balance sheet |
| **Real-Time** | WebSocket-powered live notifications |
| **PDF Engine** | 100KB+ custom PDF generator for statements, tickets, receipts, and gift cards |
| **Automation** | APScheduler for auto-pay mandates & daily auto-savings |
| **Mobile-Ready** | PWA + Android APK via Capacitor, GitHub Actions CI |

---

## 🛠 Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| **Python 3.12** | Core language |
| **FastAPI 0.100+** | Async REST API framework |
| **SQLAlchemy 2.0 (async)** | ORM with full async support |
| **PostgreSQL 16** | Primary database (integer paise, no floats) |
| **Alembic** | Database migrations |
| **APScheduler** | Background job scheduler (mandates, auto-saves) |
| **Redis** | Caching & rate limiting |
| **bcrypt** | PIN hashing (never stored in plaintext) |
| **ReportLab** | PDF generation engine (100KB+ generator) |
| **Google Gemini / OpenAI** | AI provider for Saathi assistant |
| **Uvicorn** | ASGI server |

### Frontend

| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Vite** | Build tool & dev server |
| **Tailwind CSS** | Utility-first styling with custom design tokens |
| **PDF.js (pdfjs-dist)** | In-app PDF canvas renderer |
| **Capacitor** | Native Android APK bridge |
| **Axios** | HTTP client with JWT interceptor & auto-refresh |

### Infrastructure

| Technology | Purpose |
|---|---|
| **Docker + Docker Compose** | Containerized full stack (api + web + db + redis) |
| **Nginx** | Frontend static file server |
| **GitHub Actions** | CI/CD pipeline for Android APK builds |
| **Vercel** | Frontend production deployment |

---

## 🏗 Architecture

```
+----------------------------------------------------------+
|                    RenoPay Frontend                       |
|  React 19 + Vite + TailwindCSS + Capacitor (Android)     |
|  25 Screens · PWA · Day/Night Mode · PDF.js Viewer       |
+---------------------+------------------------------------+
                      | HTTPS REST + WebSocket
+---------------------v------------------------------------+
|                    FastAPI Backend                        |
|  20+ Routers · Async SQLAlchemy · JWT Auth               |
|  SentinAI Fraud Engine · APScheduler · PDF Generator     |
+------+---------------+----------------------+-----------+
       |               |                      |
  +----v-----+   +-----v-----+        +-------v------+
  |PostgreSQL|   |   Redis   |        | Gemini / GPT |
  |    16    |   |  Cache    |        |  AI Engine   |
  +----------+   +-----------+        +--------------+
```

### Key Design Decisions

- **Integer Paise, not floats**: All money stored as `BigInteger` paise (Rs.1 = 100 paise) — eliminates floating-point precision bugs in financial calculations.
- **Append-Only Ledger**: Transactions are never updated or deleted — immutable audit trail. One payment creates TWO rows (debit + credit) linked by `txn_group_id`.
- **Row-Level Locking**: `SELECT FOR UPDATE` on accounts during payments prevents double-spend race conditions.
- **Idempotency Keys**: Every payment request has a unique key stored in `idempotency_keys` to prevent duplicate charges on network retry.
- **Server-Side Fraud Detection**: SentinAI runs entirely on the backend — cannot be bypassed by a modified client.

---

## 💳 Core Payment Features

### 1. Send Money (UPI Pay)
- Send money to any UPI VPA (`user@renopay`, `merchant@upi`, etc.)
- **Advanced Pay Mode**: Drag-and-drop cash note slider UI — animated Rs.100/Rs.500/Rs.2000 notes physically "handed" to the recipient
- Smart UPI ID resolution with contact name lookup
- UPI PIN authentication (bcrypt verified server-side)
- Real-time SentinAI fraud score shown before confirmation
- Round-up to nearest Rs.10 auto-saved to Digital Gold

### 2. QR Code Payments
- **Scan & Pay**: Camera-based BharatQR / UPI QR scanner
- **Receive Money**: Personal dynamic QR code with amount embedding
- Downloadable & shareable QR card

### 3. Money Requests
- Request money from any UPI ID
- Inbox: Accept (pay with PIN) or Decline incoming requests
- Sent requests tracking with status

### 4. Bill Splitting
- Split expenses equally or with custom amounts
- Instant collection requests sent to group members
- Real-time settlement tracking

### 5. Subscriptions & Auto-Pay Mandates
- Create recurring mandates (monthly, quarterly, yearly)
- **Automatic background execution**: APScheduler runs every 5 minutes, processes due mandates through the same payment engine (fraud checks + ledger)
- Pause / cancel anytime
- Retries on insufficient balance

### 6. Add Money
- Top-up virtual account from linked bank
- Virtual account number + IFSC for IMPS/NEFT/RTGS transfers

---

## 🔐 Security & Fraud Detection — SentinAI

RenoPay's **SentinAI** is a server-side rule-based fraud engine (with a clear upgrade path to ML). Every payment is scored before execution.

### 6 Independent Risk Signals

| Signal | Trigger | Risk Level |
|---|---|---|
| **High Amount** | Transaction > Rs.10,000 (configurable) | Medium |
| **Odd Hours** | Payment between 1–4 AM IST | Medium |
| **New/Unknown Device** | Device fingerprint not in trusted list | Medium |
| **Geo-Velocity** | >200 km distance in <2 hours (Haversine formula) | High / Blocked |
| **Bot-Speed Input** | Note entry < 400ms per note (drag-speed detection) | High / Blocked |
| **Device Tilt Anomaly** | Accelerometer tilt > 45 degrees | Medium |

### Trust Score System
- **93–99**: Low risk (green) — transaction approved instantly
- **75–89**: Medium risk (amber) — user sees warning, can proceed
- **40–69**: High risk (red) — transaction blocked or requires extra confirmation
- `blocked = True` when bot_speed + geo_velocity flags combine with 2+ other signals

### Security Features
- **bcrypt PIN hashing** — raw PINs never stored
- **JWT + Refresh Tokens** — 30-min access tokens, 7-day refresh
- **PIN lockout** — 5 failed attempts triggers lockout with exponential backoff
- **Aadhaar encrypted at rest** — AES encryption on PAN/Aadhaar fields
- **KYC Status** — `PENDING` / `VERIFIED` / `REJECTED` on every user
- **Trusted Device Registry** — Device fingerprints stored per-user, timestamp-tracked
- **Fraud Event Audit Trail** — Every SentinAI decision logged (including allowed transactions)
- **Idempotency Keys** — Prevents double-spend on network retry

---

## 💰 Savings & Investment Features

### Personal Savings Goals — "Treasure Map"
- Create goals with custom name, icon, and target amount (e.g., Goa Trip — Rs.50,000)
- Track progress with milestone celebrations (25%, 50%, 75%, 100%)
- **Daily Auto-Save**: APScheduler deducts a configured amount daily at 9 AM
- Withdraw anytime with PIN verification
- Visual progress bar with percentage tracking

### Shared Vaults — Group Savings
- Create shared savings pots with multiple users
- Each member contributes independently
- **Multi-signature withdrawal**: ALL vault members must approve withdrawals with their PIN
- Append-only contribution history / activity feed
- Creator can add members by phone number or VPA

### Mutual Funds & Wealth Management
- Browse top **5-star equity & hybrid funds**
- Start **Monthly SIP** (Systematic Investment Plan)
- **Daily Micro SIP** — as low as Rs.10/day
- **Daily Recurring Deposit (RD)** at 8.1% p.a.
- Live portfolio tracking (invested vs. current value)
- Fund categories: Equity Growth, Hybrid, Debt, ELSS

### Instant Loans & Credit
- **Personal Loans**: Up to Rs.5 lakh, instant wallet credit
- **Mutual Fund Collateral Loans**: Up to Rs.10 lakh (pledging MF units)
- **Gold-backed Loans**: Up to Rs.15 lakh against Digital Gold
- Zero paperwork — in-app application
- EMI tracker with due dates and repayment
- PDF receipts for each disbursement and repayment

---

## ✈️ Travel & Booking System

Full travel booking platform with government-compliant PDF tickets.

### Booking Types

| Type | Features |
|---|---|
| **Flights** | Airline + flight number, seat class (Economy/Business), departure/arrival, PNR |
| **Trains** | Train number, berth class (Sleeper/AC/2AC/3AC), coach/berth assignment |
| **Buses** | Operator, seat number, departure point |
| **Hotels** | Hotel name, room type, check-in/check-out dates, room number |

### Features
- Live route & seat/berth selection UI
- Real-time pricing with base fare + tax breakdown
- **PDF Ticket Generation**: Government-layout compliant, embeds PNR, QR code, passenger details
- "My Bookings" screen with full history
- Booking cancellation
- Payment deducted from wallet with PIN auth

---

## 📱 Bills, Recharges & Financial Services

### Mobile Recharge
- **Jio, Airtel, Vi (Vodafone-Idea), BSNL** — all major operators
- Browse and select plans by validity and data
- Instant recharge with wallet balance
- PDF receipt generation

### Electricity Bill — BBPS
- BBPS-compliant electricity bill payment
- Consumer number lookup
- PDF receipt with board name and consumer details

### Other Bill Payments
- **Tuition Fee** payments with student name tracking
- **FASTag** recharges with vehicle number tracking
- **Utility bills** — water, gas, broadband

---

## 🎁 Gift Cards & Vouchers

One of RenoPay's most unique features — a complete digital gift card ecosystem.

### Creating a Gift Card
- Choose amount (Rs.100 – Rs.50,000)
- Select theme: `gold`, `premium`, `birthday`, `wedding`, `corporate`
- Add recipient name and personal message
- **Two payment modes**:
  - **Normal Pay**: Enter UPI PIN to fund the card
  - **Advance Pay**: Drag-and-drop cash note slider experience
- Card funded instantly by deducting creator's balance

### Gift Card Delivery
- **High-res PDF voucher**: Premium visual layout with card code, QR code, recipient name, message, and expiry
- Downloadable and shareable

### Redeeming a Gift Card
- Enter 32-character unique card code
- Amount credited instantly to wallet
- One-time use (claimed to expired)
- Claim tracked with timestamp and txn reference

---

## 📒 Double-Entry Accounting Engine

RenoPay includes a **full professional-grade double-entry accounting system** — unique among fintech apps.

### Chart of Accounts
- Hierarchical account structure: **Assets, Liabilities, Equity, Income, Expense**
- HSN/SAC codes for GST compliance
- Auto-created accounts on user registration

### Journal & Ledger
- **Auto-journaling**: Every payment automatically creates a balanced journal entry (debit + credit)
- Manual journal entry creation
- Ledger view per account with running balance
- **Payee Ledger**: View all transactions with a specific counterparty VPA

### Financial Reports

| Report | Description |
|---|---|
| **Trial Balance** | All accounts with debit/credit totals — verifies books balance |
| **Profit & Loss (P&L)** | Income vs. expense statement for any date range |
| **Balance Sheet** | Assets vs. liabilities snapshot at any date |
| **Cash Flow Statement** | Operating, investing, financing activity breakdown |
| **GST Report** | Tax collected/paid summary for filing |
| **Payroll Generator** | Employee salary calculation with deductions |

### Invoices
- Create invoices for customers
- One-click payment marks invoice as PAID and auto-journals the receipt
- Pending / Paid / Cancelled status tracking

### Dev Mode
- Toggle **Dev Mode** to see double-entry T-account view of every transaction
- Shows exactly how each payment flows through the ledger

---

## 🤖 Saathi AI Assistant

**Saathi** ("companion" in Hindi) is RenoPay's multilingual AI financial assistant.

### Languages Supported

| Language | Code | Sample Greeting |
|---|---|---|
| English | `en` | Hello! How can I assist you with RenoPay today? |
| Hindi | `hi` | Namaste! Main RenoPay mein aapki kya madad kar sakta hoon? |
| Tamil | `ta` | Vanakkam! RenoPay-l ungalukku naana evvaru utava mudiyum? |
| Telugu | `te` | Namaskaram! RenoPaylo meeku nenu ela sahayapadagalanu? |
| Malayalam | `ml` | Namaskaram! RenoPay-l njan ningale engane sahayikkanam? |

### Capabilities
- **Screen-aware context**: Knows which screen the user is on and gives relevant advice
- **RAG Engine**: Retrieval-augmented generation using RenoPay's own knowledge base
- **Rate limiting**: Per-user query rate limiting to prevent abuse
- **Session management**: Persistent chat sessions, message history
- **Multi-provider AI**: Supports Google Gemini and OpenAI backends
- **Founder recognition**: Identifies Rishabh Raj as founder in all 5 languages
- **Financial guidance**: UPI how-tos, feature explanations, security tips

---

## 📊 Expense Analytics & PDF Reports

### Expense Tracker
- **Period filters**: Week / Month / All Time / Custom Date Range
- Quick preset ranges: Last 7D, Last 30D, This Month
- **Category breakdown** with spend percentages and color-coded bars:
  - Food · Shopping · Transport · Bills · Entertainment
  - Health · Education · Investment · Income · Other

### Budget Adherence
- Per-user configurable monthly budget (default Rs.15,000)
- Visual gauge showing % used
- Status: Well on track / Moderate burn rate / Over budget risk
- Remaining budget display

### AI Budget Prediction
- ML-powered spend prediction for end of month
- Based on current burn rate and historical patterns

### PDF Statement Generation
- **2-page visual financial statement** (generated server-side with ReportLab)
- Covers: period summary, total spent/income, net, category breakdown, budget adherence
- 100KB+ custom PDF engine with RenoPay branding
- **In-app PDF viewer**: PDF.js canvas rendering (no external app needed)
- Download or share directly from modal

---

## 🎰 Rewards & Gamification

### Scratch Cards
- Earn scratch cards on qualifying payments
- Animated scratch-reveal UI
- Reward types: cashback, discount coupons, bonus credits

### Reward Coins
- Accumulate coins across all app activity
- **Withdraw to bank**: Convert coins to real money (with PIN)
- Coin balance and history tracking

---

## 🥇 Digital Gold

24K, 99.9% purity physical-backed digital gold investment.

### Features
- **Buy Gold**: Invest any amount, get exact gram equivalent at live rate
- **Sell Gold**: Instant cash out at live rate, credited to wallet
- **Round-Up Savings**: Every payment auto-rounds up to nearest Rs.10, difference invested in gold
- Gold balance displayed in both Rs. and grams
- Gold ledger with buy/sell history

---

## ⚡ UPI Lite — Pinless Wallet

On-device wallet for small, fast payments — no PIN required.

### Features
- Max balance: Rs.2,000
- Max per-transaction: Rs.500
- **Zero-friction payments** — no PIN entry for small amounts
- Top-up from main wallet (PIN required for top-up)
- Separate balance display on dashboard

---

## 📡 Real-Time Features — WebSocket

- **Live payment notifications**: Instant credit/debit alerts via WebSocket
- Connection management with automatic reconnection
- Event types: payment received, mandate executed, goal milestone reached
- Used by `useRenoSocket.js` hook across all screens

---

## 🎨 UI/UX & Theme System

### Design System
- **Outfit** font (Google Fonts) for UI text
- **Space Mono** for financial numbers and monospace data
- Custom design tokens via CSS variables + Tailwind config
- Curated color palette: `#FF6A1A` accent (RenoPay orange), `#22C55E` teal, `#ff3d60` danger

### Day Mode / Night Mode
- Full light/dark theme support via CSS variable tokens
- Smooth transitions (0.25s ease)
- Theme-aware Tailwind classes (`bg-bg`, `bg-card`, `text-textLight`, `text-muted`)
- Toggle in Profile screen

### Animations & Micro-interactions
- fadeUp, fadeIn, pulseScale animations
- Heartbeat gauge animation
- Radial glow effects on hero sections
- Smooth progress bar transitions (700ms)
- Spin animations on loading states
- Button active scale(0.94) haptic feedback

### Responsive Design
- Mobile-first (375px base)
- Bottom navigation with pill-style active indicator
- Sticky top app bars with blur backdrop
- Touch-optimized targets

---

## ⚙️ Backend Infrastructure

### API Architecture
- **20 Router modules** mounted under clean prefixes:
  ```
  /auth  /accounts  /payments  /requests  /mandates  /rewards
  /goals  /vaults  /lite  /analytics  /gold  /accounting
  /ai  /travel  /financial  /gift-cards  /ws
  ```
- Global exception handler with traceback logging
- `/health` endpoint with database connectivity check
- CORS configured for web + Capacitor native

### Database Design
- **15+ SQLAlchemy models** with UUID primary keys
- All timestamps in UTC with timezone awareness
- `BigInteger` paise for all monetary values — zero float risk
- Check constraints at DB level for balance non-negative
- Cascade deletes configured correctly

### Background Jobs — APScheduler

| Job | Schedule | Purpose |
|---|---|---|
| `run_due_mandates` | Every 5 minutes | Execute overdue auto-pay mandates |
| `run_auto_saves` | Daily at 9:00 AM | Deduct daily auto-save for savings goals |

### Payment Engine Core (`payment_engine.py`)
- Row-level locking (`SELECT FOR UPDATE`) prevents race conditions
- Atomic debit + credit in single transaction
- SentinAI fraud check before every payment
- Round-up calculation and Digital Gold auto-investment
- Automatic double-entry journal entry creation
- Idempotency key deduplication

---

## 📚 API Reference Summary

### Authentication (`/auth`)
| Endpoint | Method | Description |
|---|---|---|
| `/auth/register` | POST | Register new user, returns JWT |
| `/auth/login` | POST | Login with phone + PIN, returns JWT |
| `/auth/verify-pin` | POST | Verify PIN for in-app confirmation |
| `/auth/pin` | PATCH | Set/update UPI PIN |

### Accounts (`/accounts`)
| Endpoint | Method | Description |
|---|---|---|
| `/accounts/me` | GET | Full profile + account balance |
| `/accounts/budget` | PATCH | Update monthly budget |
| `/accounts/round-up` | PATCH | Toggle round-up savings |
| `/accounts/trust-device` | POST | Trust current device |
| `/accounts/profile-photo` | POST | Upload profile picture |
| `/accounts/preferences` | PATCH | Language, theme preferences |

### Payments (`/payments`)
| Endpoint | Method | Description |
|---|---|---|
| `/payments/send` | POST | Send money to UPI VPA |
| `/payments/add-money` | POST | Top-up from bank |
| `/payments/transactions` | GET | Transaction history |
| `/payments/resolve/:vpa` | GET | Resolve VPA to name |
| `/payments/voice-parse` | POST | Parse voice command to payment |

### Analytics (`/analytics`)
| Endpoint | Method | Description |
|---|---|---|
| `/analytics/expenses` | GET | Expense summary by period |
| `/analytics/expenses/pdf` | GET | Generate PDF statement |
| `/analytics/budget-prediction` | GET | AI spend prediction |
| `/analytics/report` | GET | Download full report |

### Accounting (`/accounting`)
| Endpoint | Method | Description |
|---|---|---|
| `/accounting/chart-of-accounts` | GET | Full chart of accounts |
| `/accounting/journal` | GET | Journal entries |
| `/accounting/ledger/:id` | GET | Account ledger |
| `/accounting/trial-balance` | GET | Trial balance |
| `/accounting/pnl` | GET | P&L statement |
| `/accounting/balance-sheet` | GET | Balance sheet |
| `/accounting/cash-flow` | GET | Cash flow statement |
| `/accounting/reports/gst` | GET | GST report |
| `/accounting/payroll/generate` | POST | Generate payroll |
| `/accounting/invoices` | GET/POST | Invoice management |

### AI (`/ai`)
| Endpoint | Method | Description |
|---|---|---|
| `/ai/query` | POST | Ask Saathi a question |
| `/ai/sessions` | GET | Chat session list |
| `/ai/sessions/:id/messages` | GET | Message history |

---

## 🗃 Database Schema

```
users ─────────────────── devices (trusted device registry)
  |
  └── accounts ──+──── transactions (append-only ledger + fraud_events)
                 +──── savings_goals
                 +──── shared_vaults ─── shared_vault_members
                 |                    ── shared_vault_logs
                 |                    ── shared_vault_withdrawal_requests
                 +──── mandates (recurring auto-pay)
                 +──── scratch_cards (rewards)
                 +──── user_gold_pot ─── gold_ledger
                 +──── investments (SIP, RD, MF)
                 +──── loans
                 +──── bill_payments
                 +──── travel_bookings
                 +──── gift_cards (creator + claimer)
                 +──── money_requests (inbox/sent)
                 +──── chart_of_accounts ─── journal_entries ─── journal_lines
                 |                        ── ledger_audit_logs
                 +──── invoices
                 +──── ai_chat_sessions ─── ai_chat_messages
                 └──── idempotency_keys (double-spend prevention)
```

---

## 🚢 Deployment

### Docker — Full Stack
```bash
# Clone and configure
git clone https://github.com/rajrishabh23959-oss/RENOPAY_ORIGINAL.git
cd renopay-fullstack-complete

# Configure environment
cp renopay-backend/.env.example renopay-backend/.env
# Edit .env with your DATABASE_URL, JWT_SECRET, GEMINI_API_KEY

# Start all services
docker-compose up -d

# Services:
# API:  http://localhost:8000
# Web:  http://localhost:80
# Docs: http://localhost:8000/docs
```

### Backend Standalone
```bash
cd renopay-backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend Standalone
```bash
cd renopay-frontend
npm install
npm run dev
# http://localhost:5173
```

### Android APK
GitHub Actions workflow (`.github/workflows/build-apk.yml`) automatically builds a signed Android APK using Capacitor on every push to `main`.

---

## 🏃 Running Locally

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL 16
- Redis 7

### Quick Start
```bash
# 1. Backend
cd renopay-backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload

# 2. Frontend (new terminal)
cd renopay-frontend
npm install
npm run dev
```

### Default Demo Credentials
| Field | Value |
|---|---|
| Phone | `9876543210` |
| UPI PIN | `123456` |
| VPA | `rishabhraj@renopay` |
| Starting Balance | Rs.50,000 |

---

## 📁 Project Structure

```
renopay-fullstack-complete/
├── renopay-backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, 20 routers mounted
│   │   ├── models/              # 15+ SQLAlchemy models
│   │   ├── routers/             # 20 API router modules
│   │   ├── services/
│   │   │   ├── payment_engine.py     # Core payment logic
│   │   │   ├── accounting_engine.py  # Double-entry engine (37KB)
│   │   │   ├── pdf_generator.py      # PDF engine (100KB+)
│   │   │   ├── sentinai.py           # Fraud detection
│   │   │   ├── scheduler.py          # Background jobs
│   │   │   ├── gold_service.py       # Digital gold
│   │   │   └── ai/
│   │   │       ├── providers.py      # Gemini/OpenAI
│   │   │       ├── prompts.py        # Multilingual prompts (40KB)
│   │   │       ├── knowledge_base.py # RAG knowledge base
│   │   │       └── rag_engine.py     # Retrieval engine
│   │   └── core/
│   │       ├── config.py        # App settings
│   │       ├── security.py      # JWT + bcrypt
│   │       └── money.py         # Txn ref generation
│   ├── alembic/                 # Database migrations
│   └── tests/                   # Pytest test suite
│
├── renopay-frontend/
│   └── src/
│       ├── screens/             # 25 screen components
│       ├── components/          # Shared UI components
│       ├── lib/
│       │   ├── api.js           # All API calls
│       │   ├── http.js          # Axios + JWT interceptor
│       │   └── format.js        # Currency formatting
│       └── hooks/
│           └── useRenoSocket.js # WebSocket hook
│
├── .github/workflows/
│   └── build-apk.yml            # Android APK CI/CD
└── docker-compose.yml           # Full stack orchestration
```

---

## 📊 Feature Count Summary

| Category | Features |
|---|---|
| Core Payments | 6 — Send, QR, Request, Split, Mandates, Add Money |
| Security | 8 — SentinAI (6 signals), KYC, PIN lock, Device trust, Idempotency |
| Savings & Investment | 5 — Goals, Vaults, Mutual Funds, Loans, Digital Gold |
| Travel | 4 booking types + PDF tickets + My Bookings |
| Bills & Recharge | 5+ — Mobile, Electricity, Tuition, FASTag, Utility |
| Gift Cards | Full lifecycle — Create, Deliver PDF, Redeem |
| Accounting | 7 financial reports + Journal + Ledger + Invoices + Payroll |
| AI Assistant | 5 languages, RAG, session persistence, screen context |
| Analytics | Expense tracker + budget prediction + PDF statements |
| Rewards | Scratch cards + coin accumulation + withdrawal to bank |
| UPI Lite | Pinless wallet, Rs.2000 max balance |
| Real-Time | WebSocket live notifications |
| **Total Screens** | **25** |
| **Total API Routers** | **20** |
| **Total DB Models** | **15+** |

---

<div align="center">

**Built with love by Rishabh Raj**

*"A complete financial ecosystem — not just another payments app."*

</div>
