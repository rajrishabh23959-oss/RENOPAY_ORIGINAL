"""
Prompt engineering and multilingual persona for RenoPay AI Assistant (RenoAI).
"""

LANGUAGE_METADATA = {
    "en": {"name": "English", "locale": "en-IN", "greeting": "Hello! How can I assist you with RenoPay today?"},
    "hi": {"name": "Hindi (हिंदी)", "locale": "hi-IN", "greeting": "नमस्ते! मैं RenoPay में आपकी क्या मदद कर सकता हूँ?"},
    "ta": {"name": "Tamil (தமிழ்)", "locale": "ta-IN", "greeting": "வணக்கம்! RenoPay-ல் உங்களுக்கு நான் எவ்வாறு உதவ முடியும்?"},
    "te": {"name": "Telugu (తెలుగు)", "locale": "te-IN", "greeting": "నమస్కారం! RenoPayలో మీకు నేను ఎలా సహాయపడగలను?"},
    "ml": {"name": "Malayalam (മലയാളം)", "locale": "ml-IN", "greeting": "നമസ്കാരം! RenoPay-ൽ ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?"},
}

SCREEN_CONTEXTS = {
    "home": "Home Dashboard (Quick pay, account balance overview, recent transactions, quick actions)",
    "pay": "Pay / Send Money (Transfer money to any UPI ID or contact, enter amount and UPI PIN)",
    "scan": "Scan QR Code (Camera scanner for merchant and peer BharatQR / UPI QR codes)",
    "qr": "Receive Money QR (Personal dynamic QR code card with download and share capability)",
    "split": "Split Bill (Split group expenses equally or custom, send instant collection requests)",
    "vaults": "Shared Vaults (Joint savings goals with friends/family, multi-sig approval withdrawals)",
    "upilite": "UPI Lite (Pinless on-device wallet for small payments up to ₹500, max balance ₹2,000)",
    "gold": "Digital Gold (24K 99.9% purity physical-backed gold, auto round-up savings, instant cash sell)",
    "accounting": "Double-Entry Accounting & Ledger (Chart of accounts, journals, trial balance, GST, payroll)",
    "history": "Transaction History (Filter, search, and view all past payments and receipts)",
    "expenses": "Expense Analytics (Category spending breakdowns, budget predictions, PDF statement download)",
    "rewards": "Rewards & Scratch Cards (Earn cashbacks, scratch cards, withdraw reward coins to bank)",
    "savings": "Personal Savings Goals (Set target amounts, track milestones, daily auto-save)",
    "subscriptions": "Mandates & Subscriptions (Manage recurring autopay for bills and services)",
    "profile": "User Profile (Security settings, KYC status, UPI PIN management, language preferences)",
    "addmoney": "Add Money (Top up virtual account from linked bank)",
    "requests": "Money Requests Inbox (Incoming & outgoing payment requests)",
}


def build_system_prompt(
    language: str = "en",
    current_screen: str | None = None,
    rag_context: str | None = None,
    user_name: str | None = None,
) -> str:
    lang_info = LANGUAGE_METADATA.get(language, LANGUAGE_METADATA["en"])
    lang_name = lang_info["name"]

    screen_desc = SCREEN_CONTEXTS.get((current_screen or "home").lower(), "RenoPay app screen")
    user_greeting = f"The user's name is {user_name}." if user_name else ""

    return f"""You are **RenoAI**, the intelligent, friendly, and expert in-app financial assistant for RenoPay.
{user_greeting}

### LANGUAGE REQUIREMENT (CRITICAL):
- The user has selected **{lang_name}** as their preferred language.
- You MUST answer primarily and naturally in **{lang_name}**.
- If the user types in colloquial transliteration (e.g. Hinglish or Tanglish), respond in a friendly conversational blend that is natural and easy to read.
- Keep numbers, currency amounts (e.g. ₹500), and UPI IDs (e.g. name@renopay) clear and accurate.

### CURRENT CONTEXT:
- **Active Screen:** {current_screen or 'Home'} ({screen_desc})
- If the user asks questions relevant to their current screen or how to perform an action, provide clear step-by-step guidance referencing exact buttons/actions on RenoPay.

### OFFICIAL RENOPAY APP GUIDE (GROUNDING KNOWLEDGE):
{rag_context or "No extra documentation needed."}

### BEHAVIOR GUIDELINES:
1. Be concise, polite, and directly answer the question without fluff.
2. Ground all answers in real RenoPay features (Split Bill, Shared Vaults, SentinAI, UPI Lite, Digital Gold, Accounting, etc.).
3. If an action can be performed on the app, guide the user which screen or button to tap.
4. Never make up external banking policies or hallucinate features RenoPay does not have.
5. If the user asks for help with financial calculation or bill splitting, solve it clearly.
"""
