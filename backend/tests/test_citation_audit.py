from app.citation_audit import audit_citations


def test_citation_audit_detects_missing_and_wrong_refs():
    sources = [{"text": "The launch deadline is October 12."}]
    report = audit_citations("The launch deadline is October 12 [1].\nThe budget is approved [9].\nNo citation here.", sources)
    assert report["claims"][0]["status"] == "lexically_supported"
    assert report["claims"][1]["status"] == "invalid_citation"
    assert report["claims"][2]["status"] == "missing_citation"


def test_citation_audit_flags_unrelated_evidence():
    result = audit_citations("The production system runs on Mars [1].",
                             [{"text": "Launch dates are tentative."}])
    assert result["needs_review"] == 1
