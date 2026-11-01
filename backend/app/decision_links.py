"""Evidence relationships based on explicit, verifiable references only.

Never infer causation from keyword overlap.
"""
import re
from urllib.parse import urlsplit

ISSUE = re.compile(r"\b[A-Z][A-Z0-9]{1,9}-[1-9][0-9]{0,7}\b")
PR = re.compile(r"(?i)\b(?:pull request|\bPR)\s*#?(\d{1,7})\b")


def references(text):
    value = str(text or "")
    return set(ISSUE.findall(value)) | {"PR#" + n for n in PR.findall(value)}


def related_sources(sources, *, max_links=20):
    """Return candidate links only when two independently cited items share an explicit ID."""
    matched = []
    for index, item in enumerate(sources):
        label = " ".join(str(item.get(key) or "") for key in ("title", "text"))
        ids = references(label)
        if not ids:
            continue
        for earlier in range(index):
            other = sources[earlier]
            if item.get("provider") == other.get("provider") and item.get("source_id") == other.get("source_id"):
                continue
            other_ids = references(" ".join(str(other.get(key) or "") for key in ("title", "text")))
            common = sorted(ids & other_ids)
            if common:
                matched.append({"left": earlier + 1, "right": index + 1,
                                "references": common, "status": "shared_reference"})
                if len(matched) >= max_links:
                    return matched
    return matched
