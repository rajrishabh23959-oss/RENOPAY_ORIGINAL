"""
Curated knowledge base of RenoPay features and documentation.
Used by RAG retrieval engine to provide accurate, hallucination-free assistance.
"""

RENOPAY_DOCS = [
    {
        "id": "split_bill",
        "title": "Split Bill (Expense Splitting with Friends & Groups)",
        "screen": "split",
        "keywords": ["split", "bill", "share", "friends", "group", "divide", "expense", "settle", "contribute"],
        "content": (
            "RenoPay Split Bill feature allows users to split restaurant, trip, or shared expenses:\n"
            "1. Navigate to 'Split Bill' from the Home screen quick actions.\n"
            "2. Enter the Total Bill amount and a description (e.g. 'Goa Trip Dinner').\n"
            "3. Add participants by their Phone Number or RenoPay UPI ID (VPA).\n"
            "4. RenoPay automatically calculates equal shares or allows custom amounts per person.\n"
            "5. Tap 'Send Split Requests' to dispatch instant payment requests to all participants.\n"
            "6. You can track who has paid and who is pending directly from the Requests screen."
        ),
    },
    {
        "id": "shared_vaults",
        "title": "Shared Vaults (Joint Savings & Multi-Sig Withdrawals)",
        "screen": "vaults",
        "keywords": ["vault", "vaults", "shared", "pool", "joint", "savings", "multi-sig", "group target", "emergency"],
        "content": (
            "RenoPay Shared Vaults allow groups, roommates, or couples to save money together towards a shared target:\n"
            "1. Navigate to 'Shared Vaults' from the Home screen or menu.\n"
            "2. Tap 'Create New Vault', give it a title (e.g., 'Apartment Rent & Bills' or 'Japan Trip 2025'), and set a target amount.\n"
            "3. Add members using their phone numbers or VPAs.\n"
            "4. Any member can contribute funds to the vault at any time using their UPI PIN.\n"
            "5. Withdrawals require Multi-Signature Approval: when someone requests a withdrawal, members receive a prompt to approve or decline.\n"
            "6. Emergency individual withdrawals of own contributions are supported if needed."
        ),
    },
    {
        "id": "sentinai_security",
        "title": "SentinAI AI Fraud Detection & Device Security",
        "screen": "sentinai",
        "keywords": ["sentinai", "fraud", "security", "device", "trusted", "pin", "protection", "risk", "privacy code", "geo-velocity"],
        "content": (
            "SentinAI is RenoPay's proprietary real-time AI security & fraud detection engine:\n"
            "1. Risk Scoring: Every payment is evaluated in milliseconds based on recipient history, transaction size, and velocity.\n"
            "2. Geo-Velocity Check: If a transaction occurs from a distant city/device faster than physically travelable, SentinAI flags it.\n"
            "3. Trusted Devices: In Profile, tap 'Trust This Device' to whitelist your current browser/phone. Untrusted devices require additional verification.\n"
            "4. High-Value Privacy Codes: For transactions exceeding ₹2,000, SentinAI may prompt for a secondary Privacy Code or additional verification.\n"
            "5. Failed PIN Lockout: 5 consecutive incorrect PIN entries locks the account for 15 minutes to prevent brute-force attacks."
        ),
    },
    {
        "id": "upi_lite",
        "title": "UPI Lite (Pinless Instant Small Payments)",
        "screen": "upilite",
        "keywords": ["upi lite", "lite", "small payments", "pinless", "wallet", "speed", "quick pay", "offline"],
        "content": (
            "RenoPay UPI Lite provides lightning-fast 1-click payments without needing a UPI PIN:\n"
            "1. Maximum balance allowed in UPI Lite is ₹2,000.\n"
            "2. Maximum single transaction limit is ₹500.\n"
            "3. Go to 'UPI Lite' from the Home screen and top up from your main RenoPay account balance using your UPI PIN.\n"
            "4. While sending money or scanning a QR code, toggle 'Use UPI Lite' to execute payments instantly without entering a PIN.\n"
            "5. Transactions have near-zero bank server failure rates because they process on-device."
        ),
    },
    {
        "id": "digital_gold",
        "title": "Digital Gold & Auto Round-Up Savings",
        "screen": "gold",
        "keywords": ["gold", "digital gold", "round up", "roundup", "24k", "savings", "invest", "withdraw gold"],
        "content": (
            "RenoPay Digital Gold allows 24 Karat 99.9% purity digital gold accumulation:\n"
            "1. Round-Up Feature: In Profile screen, toggle 'Round-Up to Digital Gold'. When enabled, transactions are rounded up to the nearest ₹10 or ₹50, and the spare change is automatically saved as Digital Gold!\n"
            "2. View your total gold balance in INR and grams on the Digital Gold screen.\n"
            "3. Instant Cash Withdrawal: You can sell/withdraw your gold back into your main account balance anytime with your UPI PIN directly from Profile or Gold screen."
        ),
    },
    {
        "id": "cash_drawer",
        "title": "Smart Cash Drawer & Offline Currency Denominations",
        "screen": "cash",
        "keywords": ["cash", "notes", "denominations", "500", "200", "100", "50", "currency", "drawer", "offline cash"],
        "content": (
            "RenoPay Smart Cash Denominations tracks physical cash on hand:\n"
            "1. Shows exact breakdown of currency notes: ₹500, ₹200, ₹100, ₹50, ₹20, ₹10.\n"
            "2. Automatically updates denominations when cash is withdrawn or deposited.\n"
            "3. Perfect for merchants, small businesses, and individuals managing both digital UPI and cash transactions."
        ),
    },
    {
        "id": "accounting_ledger",
        "title": "Double-Entry Accounting, Journals, Trial Balance & GST Reports",
        "screen": "accounting",
        "keywords": ["accounting", "ledger", "double entry", "journal", "trial balance", "gst", "gstr", "payroll", "invoice", "debit", "credit"],
        "content": (
            "RenoPay includes an enterprise-grade Double-Entry Accounting Engine:\n"
            "1. Chart of Accounts: Standard assets, liabilities, equity, revenues, and expenses accounts (e.g., Bank, Cash Drawer, UPI Clearing, Accounts Receivable, Sales, Operating Expenses).\n"
            "2. Journal Entries: Every payment automatically logs balanced Debit and Credit lines with audit timestamps.\n"
            "3. Trial Balance: Generates real-time balanced debit/credit summaries as of any selected date.\n"
            "4. GST Reports: Generates automated GSTR-1 and GSTR-3B tax compliance summaries with CGST, SGST, and IGST breakdowns.\n"
            "5. Payroll Generation: Run monthly salary calculations with basic pay, HRA, and tax deductions with one click.\n"
            "6. Invoicing: Create branded customer invoices and track their payment settlement status."
        ),
    },
    {
        "id": "qr_and_pay",
        "title": "Scan & Pay, Personal QR Card & Money Transfers",
        "screen": "pay",
        "keywords": ["pay", "scan", "qr", "send money", "vpa", "upi id", "download qr", "transfer"],
        "content": (
            "RenoPay provides effortless money transfers via QR codes and UPI IDs:\n"
            "1. Pay Screen: Enter any recipient's UPI ID (e.g. friend@renopay or user@okhdfcbank), amount, and note, then confirm with your UPI PIN.\n"
            "2. Scan Screen: Point your camera at any BharatQR or UPI QR code to automatically parse recipient and amount.\n"
            "3. Receive Money QR: Under Profile screen or 'Receive' button, view your unique RenoPay QR code. Tap 'Download QR Code' to generate a high-res branded sharing card to save or print."
        ),
    },
    {
        "id": "voice_upi",
        "title": "Voice UPI (Spoken Payment Commands)",
        "screen": "voice",
        "keywords": ["voice", "speak", "mic", "talk", "voice upi", "voice pay", "speech", "command"],
        "content": (
            "RenoPay supports Voice-driven UPI payments:\n"
            "1. Tap the Voice UPI icon from the Home screen.\n"
            "2. Speak naturally, e.g., 'Pay 500 rupees to Praveen for lunch'.\n"
            "3. The browser extracts the recipient name, amount, and note.\n"
            "4. RenoPay resolves the contact VPA and pre-fills the payment confirmation screen for your review."
        ),
    },
    {
        "id": "savings_and_mandates",
        "title": "Savings Goals & Recurring Mandates (Autopay)",
        "screen": "savings",
        "keywords": ["goals", "mandates", "autopay", "recurring", "auto save", "target", "subscriptions"],
        "content": (
            "Automate your savings and regular bills with RenoPay:\n"
            "1. Savings Goals: Create personal savings goals with custom target amounts and deadlines. Enable 'Daily Auto-Save' to automatically stash ₹50 or ₹100 daily towards your goal.\n"
            "2. Mandates & Subscriptions: Manage recurring payments (Netflix, Rent, SIPs, Electricity) with scheduled auto-debit and pause/resume control."
        ),
    },
    {
        "id": "rewards_scratch_cards",
        "title": "Rewards, Cashbacks & Scratch Cards",
        "screen": "rewards",
        "keywords": ["rewards", "scratch", "card", "cashback", "coins", "bonus", "win"],
        "content": (
            "Earn instant cashback and rewards on RenoPay:\n"
            "1. Every eligible UPI payment grants a digital Scratch Card.\n"
            "2. Visit 'Rewards' screen, swipe to scratch and reveal real cash or digital gold prizes.\n"
            "3. Tap 'Withdraw to Bank' to instantly transfer accumulated reward money into your primary account."
        ),
    },
]
