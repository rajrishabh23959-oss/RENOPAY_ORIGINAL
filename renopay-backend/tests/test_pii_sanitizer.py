"""
Unit tests for RenoPay AI PII Redaction & Data Sanitization Layer.
"""

import pytest
from app.services.ai.sanitizer import PIISanitizer, pii_sanitizer


def test_upi_id_redaction():
    text = "Please check transaction to rahul.123@okicici and merchant@paytm"
    res = pii_sanitizer.sanitize(text)
    assert "[UPI_ID]" in res.sanitized_text
    assert "rahul.123@okicici" not in res.sanitized_text
    assert "merchant@paytm" not in res.sanitized_text
    assert "UPI_ID" in res.redacted_entities
    assert res.has_pii is True


def test_phone_number_redaction():
    cases = [
        "Call me at 9876543210 please",
        "Number is +919876543210",
        "WhatsApp on +91 9876543210",
        "My phone is +91-9876543210",
    ]
    for text in cases:
        res = pii_sanitizer.sanitize(text)
        assert "[PHONE_NUMBER]" in res.sanitized_text
        assert "9876543210" not in res.sanitized_text
        assert "PHONE_NUMBER" in res.redacted_entities


def test_bank_account_redaction():
    text = "Money debited for account 123456789012345 at SBI branch"
    res = pii_sanitizer.sanitize(text)
    assert "[ACCOUNT_NUMBER]" in res.sanitized_text
    assert "123456789012345" not in res.sanitized_text
    assert "ACCOUNT_NUMBER" in res.redacted_entities


def test_amount_redaction():
    cases = [
        ("Maine ₹5000 bheje", "[AMOUNT]"),
        ("Transfer of Rs. 4500.50 pending", "[AMOUNT]"),
        ("Paid 1200 INR to grocery store", "[AMOUNT]"),
        ("Total 350 rupaye cut gaye", "[AMOUNT]"),
        ("Sent 500 rupees yesterday", "[AMOUNT]"),
    ]
    for raw, expected_token in cases:
        res = pii_sanitizer.sanitize(raw)
        assert expected_token in res.sanitized_text
        assert "AMOUNT" in res.redacted_entities


def test_pan_and_aadhaar_redaction():
    text = "My PAN is ABCDE1234F and Aadhaar is 1234 5678 9012 for KYC"
    res = pii_sanitizer.sanitize(text)
    assert "[PAN_NUMBER]" in res.sanitized_text
    assert "[AADHAAR_NUMBER]" in res.sanitized_text
    assert "ABCDE1234F" not in res.sanitized_text
    assert "1234 5678 9012" not in res.sanitized_text


def test_email_and_card_redaction():
    text = "Email me at user@testbank.com or charge card 4111 2222 3333 4444"
    res = pii_sanitizer.sanitize(text)
    assert "[EMAIL]" in res.sanitized_text
    assert "[CARD_NUMBER]" in res.sanitized_text
    assert "user@testbank.com" not in res.sanitized_text
    assert "4111 2222 3333 4444" not in res.sanitized_text


def test_conversational_name_redaction():
    cases = [
        ("Mera naam Amit hai aur mera payment fail hua", "[NAME]"),
        ("My name is Rahul Verma, please help", "[NAME]"),
        ("I am Priya, how to reset pin?", "[NAME]"),
    ]
    for raw, expected_token in cases:
        res = pii_sanitizer.sanitize(raw)
        assert expected_token in res.sanitized_text
        assert "NAME" in res.redacted_entities


def test_composite_user_message_scenario():
    """
    Tests the exact composite query provided by the user:
    "Mera naam Amit hai, UPI ID amit@sbi se maine ₹5000 bheje account 123456789012 par, lekin fail ho gaya."
    """
    user_message = "Mera naam Amit hai, UPI ID amit@sbi se maine ₹5000 bheje account 123456789012 par, lekin fail ho gaya."
    res = pii_sanitizer.sanitize(user_message)

    assert "[NAME]" in res.sanitized_text
    assert "[UPI_ID]" in res.sanitized_text
    assert "[AMOUNT]" in res.sanitized_text
    assert "[ACCOUNT_NUMBER]" in res.sanitized_text
    assert "Amit" not in res.sanitized_text
    assert "amit@sbi" not in res.sanitized_text
    assert "5000" not in res.sanitized_text
    assert "123456789012" not in res.sanitized_text
    assert res.has_pii is True


def test_non_pii_query_unaltered():
    text = "Digital gold kaise buy karein aur UPI Lite limit kya hai?"
    res = pii_sanitizer.sanitize(text)
    assert res.sanitized_text == text
    assert res.has_pii is False
    assert len(res.redacted_entities) == 0
