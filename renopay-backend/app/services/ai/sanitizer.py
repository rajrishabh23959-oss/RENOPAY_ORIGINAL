"""
PII (Personally Identifiable Information) Redaction and Data Sanitization Layer for RenoPay AI Assistant.

Ensures sensitive financial and personal entities (UPI IDs, Indian phone numbers,
bank account numbers, card numbers, PAN, Aadhaar, amounts, emails, and names)
are redacted before transmission to third-party LLM providers (Groq, OpenAI, Gemini)
and prior to database persistence (Zero-Log PII architecture).
"""

import re
from typing import NamedTuple, Set

class SanitizationResult(NamedTuple):
    sanitized_text: str
    redacted_entities: Set[str]
    has_pii: bool


class PIISanitizer:
    """
    High-performance hybrid PII sanitizer tailored for Indian FinTech contexts.
    Operates at sub-millisecond latency using pre-compiled regular expressions,
    with an optional plug-and-play hook for Microsoft Presidio NER.
    """

    # 1. UPI ID: username@bank or merchant@psp
    # Handles handles like @sbi, @okaxis, @okhdfcbank, @paytm, @ybl, @upi, @postbank, etc.
    UPI_PATTERN = re.compile(
        r'(?i)\b[a-z0-9._\-]{2,256}@[a-z]{2,64}\b'
    )

    # 2. Indian Phone Number:
    # Handles 10-digit mobile numbers starting with 6-9, with optional +91 or 0 prefix
    PHONE_PATTERN = re.compile(
        r'(?:\+91[\-\s]?[6-9]\d{9}\b|\b0?[6-9]\d{9}\b)'
    )

    # 3. Bank Account Number: Typically 9 to 18 contiguous digits
    ACCOUNT_PATTERN = re.compile(
        r'\b\d{9,18}\b'
    )

    # 4. Currency Amount: Handles ₹, Rs, Rs., INR followed by numbers with optional commas/decimals,
    # or numbers followed by Rs/INR/rupees/rupaye
    AMOUNT_PATTERN = re.compile(
        r'(?i)(?:₹|Rs\.?|INR)\s*\d+(?:,\d+)*(?:\.\d{1,2})?|\b\d+(?:,\d+)*(?:\.\d{1,2})?\s*(?:₹|Rs\.?|INR|rupees|rupaye)\b'
    )

    # 5. Email Address
    EMAIL_PATTERN = re.compile(
        r'(?i)\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b'
    )

    # 6. PAN Card: Standard 10-character alphanumeric Indian PAN format (e.g. ABCDE1234F)
    PAN_PATTERN = re.compile(
        r'\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b'
    )

    # 7. Debit / Credit Card: 4 groups of 4 digits with spaces/hyphens, or common 16-digit card prefixes
    CARD_PATTERN = re.compile(
        r'\b(?:\d{4}[-\s]){3}\d{4}\b|\b(?:4\d{15}|5[1-5]\d{14}|6(?:011|5\d{2})\d{12})\b'
    )

    # 8. Aadhaar Number: 12 digits in 3 groups of 4 with spaces or hyphens (e.g. 1234 5678 9012)
    AADHAAR_PATTERN = re.compile(
        r'\b\d{4}[-\s]\d{4}[-\s]\d{4}\b'
    )

    # 9. Conversational Name Introductions (Hindi, Hinglish, and English)
    # Catches: "Mera naam Amit hai", "My name is Rahul", "I am Priya", "User Amit Verma"
    NAME_PATTERNS = [
        re.compile(r'(?i)\bmera\s+naam\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:hai|tha)\b'),
        re.compile(r'(?i)\bmy\s+name\s+is\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b'),
        re.compile(r'(?i)\bi\s+am\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b'),
    ]

    @classmethod
    def sanitize(cls, text: str) -> SanitizationResult:
        """
        Main sanitization entry point. Scans and masks sensitive PII.
        Returns a SanitizationResult tuple with sanitized string and audit flags.
        """
        if not text or not isinstance(text, str):
            return SanitizationResult(sanitized_text=text or "", redacted_entities=set(), has_pii=False)

        sanitized = text
        redacted = set()

        # Step 1: Specific high-priority entities first
        # Email before UPI (to avoid partial masking if email domain matches)
        if cls.EMAIL_PATTERN.search(sanitized):
            sanitized = cls.EMAIL_PATTERN.sub('[EMAIL]', sanitized)
            redacted.add("EMAIL")

        # UPI ID
        if cls.UPI_PATTERN.search(sanitized):
            sanitized = cls.UPI_PATTERN.sub('[UPI_ID]', sanitized)
            redacted.add("UPI_ID")

        # PAN
        if cls.PAN_PATTERN.search(sanitized):
            sanitized = cls.PAN_PATTERN.sub('[PAN_NUMBER]', sanitized)
            redacted.add("PAN_NUMBER")

        # Credit / Debit Cards (Must run BEFORE Aadhaar because 4 groups of 4 is longer than 3 groups of 4)
        if cls.CARD_PATTERN.search(sanitized):
            sanitized = cls.CARD_PATTERN.sub('[CARD_NUMBER]', sanitized)
            redacted.add("CARD_NUMBER")

        # Aadhaar (3 groups of 4 with spaces/hyphens)
        if cls.AADHAAR_PATTERN.search(sanitized):
            sanitized = cls.AADHAAR_PATTERN.sub('[AADHAAR_NUMBER]', sanitized)
            redacted.add("AADHAAR_NUMBER")

        # Amounts (₹, Rs., INR)
        if cls.AMOUNT_PATTERN.search(sanitized):
            sanitized = cls.AMOUNT_PATTERN.sub('[AMOUNT]', sanitized)
            redacted.add("AMOUNT")

        # Indian Phone Numbers
        if cls.PHONE_PATTERN.search(sanitized):
            sanitized = cls.PHONE_PATTERN.sub('[PHONE_NUMBER]', sanitized)
            redacted.add("PHONE_NUMBER")

        # Bank Account Numbers (9-18 digits).
        # Any remaining isolated 9-18 digit strings that weren't masked by phone/card/aadhaar
        if cls.ACCOUNT_PATTERN.search(sanitized):
            sanitized = cls.ACCOUNT_PATTERN.sub('[ACCOUNT_NUMBER]', sanitized)
            redacted.add("ACCOUNT_NUMBER")

        # Conversational Name extraction
        for pattern in cls.NAME_PATTERNS:
            match = pattern.search(sanitized)
            if match:
                name_val = match.group(1).strip()
                # Check that name isn't an already inserted tag like [UPI_ID]
                if name_val and not name_val.startswith('['):
                    sanitized = sanitized.replace(name_val, '[NAME]')
                    redacted.add("NAME")

        # Step 2: Optional Presidio integration if installed in environment
        sanitized = cls._try_presidio_anonymize(sanitized, redacted)

        return SanitizationResult(
            sanitized_text=sanitized,
            redacted_entities=redacted,
            has_pii=len(redacted) > 0,
        )

    @classmethod
    def _try_presidio_anonymize(cls, text: str, redacted: Set[str]) -> str:
        """
        Attempts to run Microsoft Presidio analyzer/anonymizer if packages are installed.
        Fails safely and gracefully with zero crash if not present.
        """
        try:
            from presidio_analyzer import AnalyzerEngine
            from presidio_anonymizer import AnonymizerEngine

            analyzer = AnalyzerEngine()
            anonymizer = AnonymizerEngine()

            results = analyzer.analyze(text=text, entities=["PERSON", "LOCATION"], language="en")
            if results:
                anonymized = anonymizer.anonymize(text=text, analyzer_results=results)
                redacted.add("PRESIDIO_NER")
                return anonymized.text
        except Exception:
            # Presidio is optional; graceful fallback to Tier-1 regex
            pass
        return text


# Global singleton instance for easy import
pii_sanitizer = PIISanitizer()
