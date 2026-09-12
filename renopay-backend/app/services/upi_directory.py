import hashlib
import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.user import User, KYCStatus

# Comprehensive directory of Indian UPI handle providers
UPI_HANDLE_MAP = {
    # Paytm
    "paytm": ("Paytm Payments Bank", "Paytm"),
    "ptyes": ("YES Bank", "Paytm"),
    "pthdfc": ("HDFC Bank", "Paytm"),
    "ptsbi": ("State Bank of India", "Paytm"),
    "ptaxis": ("Axis Bank", "Paytm"),
    # PhonePe
    "ybl": ("YES Bank", "PhonePe"),
    "ibl": ("ICICI Bank", "PhonePe"),
    "axl": ("Axis Bank", "PhonePe"),
    # Google Pay
    "okaxis": ("Axis Bank", "Google Pay"),
    "okhdfcbank": ("HDFC Bank", "Google Pay"),
    "okicici": ("ICICI Bank", "Google Pay"),
    "oksbi": ("State Bank of India", "Google Pay"),
    # BharatPe / PostBank
    "bharatpe": ("BharatPe Merchant Services", "BharatPe"),
    "postbank": ("India Post Payments Bank", "BharatPe"),
    # BHIM / NPCI
    "upi": ("NPCI / BHIM", "BHIM"),
    # Amazon Pay
    "apl": ("Amazon Pay / Axis Bank", "Amazon Pay"),
    "rapl": ("Amazon Pay / RBL Bank", "Amazon Pay"),
    # CRED
    "cred": ("CRED / Axis Bank", "CRED"),
    # Banks directly
    "icici": ("ICICI Bank", "iMobile Pay"),
    "hdfcbank": ("HDFC Bank", "PayZapp"),
    "sbi": ("State Bank of India", "SBI YONO"),
    "kotak": ("Kotak Mahindra Bank", "Kotak UPI"),
    "barodampay": ("Bank of Baroda", "bob World"),
    "pnb": ("Punjab National Bank", "PNB One"),
    "axisbank": ("Axis Bank", "Axis Mobile"),
    "indus": ("IndusInd Bank", "IndusMobile"),
    "federal": ("Federal Bank", "FedMobile"),
    "rbl": ("RBL Bank", "MoBank"),
    "idfcbank": ("IDFC FIRST Bank", "IDFC Mobile"),
    "yesbank": ("YES Bank", "YES Mobile"),
    "canara": ("Canara Bank", "Canara ai1"),
    "unionbank": ("Union Bank of India", "Vyom"),
    "uco": ("UCO Bank", "UCO mBanking"),
    "centralbank": ("Central Bank of India", "Cent Mobile"),
    "indianbank": ("Indian Bank", "IndOASIS"),
    # RenoPay
    "renopay": ("RenoPay Virtual Bank", "RenoPay"),
}


def format_name_from_vpa(vpa: str) -> str:
    """Derives a human-readable recipient name from a VPA handle."""
    clean = vpa.strip()
    prefix = clean.split("@")[0] if "@" in clean else clean

    # If it's a 10-digit phone number
    if re.fullmatch(r"\d{10}", prefix):
        handle = clean.split("@")[1] if "@" in clean else "UPI"
        return f"UPI User ({prefix[:4]}...{prefix[-2:]})"

    # Clean dots, underscores, hyphens, numbers
    words = re.sub(r"[._\-+]", " ", prefix).split()
    capitalized = [w.capitalize() for w in words if w]
    if capitalized:
        return " ".join(capitalized)
    return "UPI Merchant"


def identify_upi_provider(vpa: str) -> dict:
    """Returns the identified app name and bank name for any UPI VPA."""
    clean = vpa.strip().lower()
    if "@" not in clean:
        return {"bank_name": "Standard UPI Bank", "app_name": "UPI", "is_renopay": False}

    handle = clean.split("@")[1]
    if handle == "renopay":
        return {"bank_name": "RenoPay Virtual Bank", "app_name": "RenoPay", "is_renopay": True}

    if handle in UPI_HANDLE_MAP:
        bank, app = UPI_HANDLE_MAP[handle]
        return {"bank_name": bank, "app_name": app, "is_renopay": False}

    return {
        "bank_name": f"{handle.upper()} Bank",
        "app_name": f"{handle.upper()} UPI",
        "is_renopay": False,
    }


async def get_or_create_external_account(
    db: AsyncSession, vpa: str, full_name: str | None = None
) -> Account:
    """
    Finds or auto-provisions an external clearing account in the double-entry
    banking ledger for outgoing payments to third-party UPI apps (Paytm, PhonePe, GPay, etc.).
    """
    clean_vpa = vpa.strip().lower()

    # 1. Check if an account already exists for this exact VPA
    existing_result = await db.execute(select(Account).where(Account.vpa == clean_vpa))
    existing_acc = existing_result.scalar_one_or_none()
    if existing_acc:
        return existing_acc

    # 2. Identify provider info and display name
    provider_info = identify_upi_provider(clean_vpa)
    display_name = (
        full_name.strip() if (full_name and full_name.strip()) else format_name_from_vpa(clean_vpa)
    )

    # 3. Create a deterministic virtual external user
    # Max length of User.phone_number is 15 chars
    clean_hash = hashlib.md5(clean_vpa.encode("utf-8")).hexdigest()[:8]
    ext_phone = f"+9199{clean_hash}"[:15]

    user_result = await db.execute(select(User).where(User.phone_number == ext_phone))
    ext_user = user_result.scalar_one_or_none()
    if not ext_user:
        ext_user = User(
            full_name=display_name,
            phone_number=ext_phone,
            kyc_status=KYCStatus.VERIFIED,
            is_active=True,
        )
        db.add(ext_user)
        await db.flush()

    # 4. Check if account exists for this user
    acc_check = await db.execute(select(Account).where(Account.user_id == ext_user.id))
    acc_found = acc_check.scalar_one_or_none()
    if acc_found:
        return acc_found

    # 5. Create new external account
    handle = clean_vpa.split("@")[1] if "@" in clean_vpa else "upi"
    clean_ifsc = f"{handle[:4].upper():<4}0001"[:11]
    virtual_acc = f"EXT{clean_hash[:12].upper()}"[:20]

    external_account = Account(
        user_id=ext_user.id,
        virtual_acc_no=virtual_acc,
        ifsc_code=clean_ifsc,
        vpa=clean_vpa,
        linked_bank_name=provider_info["bank_name"],
        current_balance_paise=0,
        upi_lite_balance_paise=0,
        digital_gold_paise=0,
        monthly_budget_paise=1_500_000,
    )
    db.add(external_account)
    await db.flush()
    return external_account
