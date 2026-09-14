import pytest
from app.services.ai.rag_engine import retrieve_relevant_docs
from app.services.ai.prompts import build_system_prompt, SCREEN_CONTEXTS

def test_rag_retrieval_travel_tickets():
    docs = retrieve_relevant_docs("ticket kaise book kare train flight")
    titles = [d["title"] for d in docs]
    assert any("Travel & Transit" in t for t in titles)

def test_rag_retrieval_loans():
    docs = retrieve_relevant_docs("how can I get an instant loan and repay emi")
    titles = [d["title"] for d in docs]
    assert any("Instant Loans" in t for t in titles)

def test_rag_retrieval_recharge_and_bills():
    docs = retrieve_relevant_docs("mobile recharge jio bijli bill")
    titles = [d["title"] for d in docs]
    assert any("Recharge" in t for t in titles)

def test_rag_retrieval_payment_modes():
    docs = retrieve_relevant_docs("normal pay vs advance pay note slider")
    titles = [d["title"] for d in docs]
    assert any("Payment Modes: Normal Pay vs Advance Pay" in t for t in titles)

def test_screen_contexts_include_new_features():
    assert "travel" in SCREEN_CONTEXTS
    assert "loans" in SCREEN_CONTEXTS
    assert "recharge" in SCREEN_CONTEXTS
    assert "mutualfunds" in SCREEN_CONTEXTS
