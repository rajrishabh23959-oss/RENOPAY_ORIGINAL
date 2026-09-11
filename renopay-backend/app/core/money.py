"""
Single source of truth for money conversions. The DB and all internal
logic use integer paise; only the API boundary (request/response JSON)
speaks rupees, and only through these two functions — never inline
`* 100` or `/ 100` anywhere else in the codebase.
"""
import secrets
import uuid
from decimal import Decimal


def rupees_to_paise(rupees: float | int) -> int:
    return int(Decimal(str(rupees)) * 100)


def paise_to_rupees(paise: int) -> float:
    return round(paise / 100, 2)


def generate_txn_ref() -> str:
    suffix = secrets.token_hex(6).upper()
    return f"RENO-TXN-{suffix}"


def generate_virtual_acc_no() -> str:
    return f"41110{secrets.randbelow(10000000):07d}"


def new_txn_group_id() -> uuid.UUID:
    return uuid.uuid4()
