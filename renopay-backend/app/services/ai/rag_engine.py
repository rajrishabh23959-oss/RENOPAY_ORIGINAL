"""
RAG (Retrieval-Augmented Generation) engine for RenoPay.
Finds and retrieves relevant RenoPay documentation chunks based on user query
and current screen context to ground the LLM with factual app knowledge.
"""
import re
from app.services.ai.knowledge_base import RENOPAY_DOCS

STOP_WORDS = {
    "a", "an", "the", "in", "on", "at", "to", "for", "of", "and", "or", "is",
    "are", "was", "how", "what", "where", "can", "i", "you", "me", "my", "this",
    "that", "it", "do", "does", "kare", "kaise", "kya", "hai", "karna", "ye", "yeh"
}


def tokenize(text: str) -> set[str]:
    """Tokenize and strip punctuation, excluding short stop words."""
    words = re.findall(r"\b[a-zA-Z0-9_\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0D00-\u0D7F]{2,}\b", text.lower())
    return {w for w in words if w not in STOP_WORDS}


def retrieve_relevant_docs(query: str, current_screen: str | None = None, top_k: int = 3) -> list[dict]:
    """
    Retrieves the top-k most relevant RenoPay documentation chunks
    based on keyword overlap, content relevance, and screen boost.
    """
    query_tokens = tokenize(query)
    scored_docs = []

    for doc in RENOPAY_DOCS:
        score = 0.0

        # Screen boost: if the user is currently on this screen, strongly boost relevance
        if current_screen and doc.get("screen"):
            screen_clean = current_screen.lower().strip()
            doc_screen = doc["screen"].lower().strip()
            if screen_clean == doc_screen or doc_screen in screen_clean:
                score += 5.0

        # Keywords match (high weight)
        doc_keywords = {k.lower() for k in doc.get("keywords", [])}
        keyword_hits = query_tokens.intersection(doc_keywords)
        score += len(keyword_hits) * 3.5

        # Title match
        title_tokens = tokenize(doc.get("title", ""))
        title_hits = query_tokens.intersection(title_tokens)
        score += len(title_hits) * 2.0

        # Content match
        content_tokens = tokenize(doc.get("content", ""))
        content_hits = query_tokens.intersection(content_tokens)
        score += len(content_hits) * 0.8

        if score > 0:
            scored_docs.append((score, doc))

    # Sort descending by relevance score
    scored_docs.sort(key=lambda x: x[0], reverse=True)

    # If no matches found (e.g. general greeting), include default primary doc for the current screen
    if not scored_docs and current_screen:
        for doc in RENOPAY_DOCS:
            if doc.get("screen") == current_screen.lower():
                return [doc]

    return [item[1] for item in scored_docs[:top_k]]


def format_rag_context(docs: list[dict]) -> str:
    """Formats retrieved documentation chunks into clear system context."""
    if not docs:
        return "No specific documentation section matched."

    sections = []
    for d in docs:
        sections.append(f"### Feature: {d['title']}\n{d['content']}")
    return "\n\n".join(sections)
