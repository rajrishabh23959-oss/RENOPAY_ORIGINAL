"""
Denomination Service for RenoPay Cash Breakdown.
Maintains and updates physical currency notes and coins:
Notes: ₹500, ₹200, ₹100, ₹50, ₹20, ₹10, ₹5
Coins: ₹2, ₹1
"""

from typing import Any

DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1]


def break_down_amount(amount_rupees: int) -> dict[str, int]:
    """
    Greedy breakdown of an amount into standard Indian currency denominations.
    Example: 2585 -> {'500': 5, '50': 1, '20': 1, '10': 1, '2': 1, '1': 1}
    """
    counts: dict[str, int] = {str(d): 0 for d in DENOMINATIONS}
    rem = max(0, amount_rupees)
    for d in DENOMINATIONS:
        if rem >= d:
            count = rem // d
            counts[str(d)] = count
            rem %= d
    return counts


def calculate_total(counts: dict[str, int] | None) -> int:
    """Calculate the total rupee amount from a dictionary of denomination counts."""
    if not counts:
        return 0
    total = 0
    for d_str, count in counts.items():
        try:
            total += int(d_str) * int(count)
        except (ValueError, TypeError):
            pass
    return total


def ensure_denominations(stored: dict[str, Any] | None, balance_paise: int) -> dict[str, int]:
    """
    Ensures that an account has a valid denomination count dictionary
    whose sum strictly matches current_balance_paise // 100.
    """
    target_rupees = max(0, balance_paise // 100)
    if stored and isinstance(stored, dict):
        clean_counts = {str(d): int(stored.get(str(d), 0)) for d in DENOMINATIONS}
        if calculate_total(clean_counts) == target_rupees:
            return clean_counts
    return break_down_amount(target_rupees)


def deduct_denominations(
    current: dict[str, Any] | None,
    amount_rupees: int,
    current_balance_paise: int,
) -> dict[str, int]:
    """
    Deducts an exact amount from available notes/coins.
    If exact denominations are available, they are subtracted directly.
    If change-making is required (e.g. paying ₹15 when user only has ₹500 notes),
    it breaks larger notes into smaller denominations so the final counts match the remaining balance.
    """
    counts = ensure_denominations(current, current_balance_paise)
    remaining_to_deduct = amount_rupees
    new_target_rupees = max(0, (current_balance_paise // 100) - amount_rupees)

    # 1. Greedy subtraction from available notes/coins
    for d in DENOMINATIONS:
        key = str(d)
        avail = counts.get(key, 0)
        if avail > 0 and remaining_to_deduct >= d:
            needed = remaining_to_deduct // d
            take = min(avail, needed)
            counts[key] -= take
            remaining_to_deduct -= take * d

    # 2. If leftover remainder cannot be covered by smaller notes, make change from next larger note
    if remaining_to_deduct > 0:
        for d in sorted(DENOMINATIONS):
            key = str(d)
            if counts.get(key, 0) > 0 and d > remaining_to_deduct:
                counts[key] -= 1
                change = d - remaining_to_deduct
                remaining_to_deduct = 0
                # Add change back as optimal smaller denominations
                change_counts = break_down_amount(change)
                for ck, cv in change_counts.items():
                    counts[ck] = counts.get(ck, 0) + cv
                break

    # Safety check: if there is any mismatch due to extreme shortage, fallback to clean breakdown
    if calculate_total(counts) != new_target_rupees:
        counts = break_down_amount(new_target_rupees)

    return counts


def add_denominations(
    current: dict[str, Any] | None,
    amount_rupees: int,
    current_balance_paise: int,
) -> dict[str, int]:
    """
    Adds optimal notes and coins when an account is credited.
    """
    counts = ensure_denominations(current, current_balance_paise)
    added = break_down_amount(amount_rupees)
    for d_str, count in added.items():
        counts[d_str] = counts.get(d_str, 0) + count
    return counts
