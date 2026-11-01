"""Conservative, deterministic citation support checks.

Lexical overlap is a *signal*, never semantic entailment. Do not call
an answer factually verified just because this heuristic passes.
"""
import re
from .retrieval import tokens


def audit_citations(answer: str, sources: list[dict], *, threshold: float = 0.35) -> dict:
    statements = [item.strip() for item in re.split(r"(?<=[.!?])\s+|\n+", answer)
                  if item.strip() and re.search(r"[A-Za-z]", item)]
    findings = []
    for statement in statements:
        ids = [int(n) for n in re.findall(r"\[(\d+)\]", statement)]
        claim = re.sub(r"\[\d+\]", "", statement)
        claim_terms = set(tokens(claim))
        valid = [n for n in ids if 1 <= n <= len(sources)]
        excerpts = " ".join(str(sources[n - 1].get("text", "")) for n in valid)
        source_terms = set(tokens(excerpts))
        overlap = len(claim_terms & source_terms) / len(claim_terms) if claim_terms else 0.0
        status = ("missing_citation" if not ids else
                  "invalid_citation" if len(valid) != len(ids) else
                  "needs_review" if not claim_terms or overlap < threshold else
                  "lexically_supported")
        findings.append({"claim": claim[:500], "citations": ids,
                         "overlap": round(overlap, 3), "status": status})
    return {"claims": findings, "needs_review": sum(row["status"] != "lexically_supported" for row in findings),
            "note": "Lexical support is not proof of factual entailment; review original sources."}
