"""Question parsing and conservative connected-source search filters."""
import re

QUERY_STOPWORDS = {'what','which','where','when','why','how','can','could','would','should',
                   'please','find','list','show','tell','me','about','the','and','or','from',
                   'my','their','in','on','for','are','is','was','were','does','did','with','give',
                   'summarize','summary','latest','recent','recently','exact','file','files','name','names','source','sources',
                   'any','there','have','google','drive','gmail','github','notion','slack','email','emails'}


def natural_search_terms(question):
    import re
    terms = []
    for word in re.findall(r"[A-Za-z0-9_+.#-]{2,}", question):
        word = word.strip('._-+#')
        if not word:
            continue
        if word.lower() not in QUERY_STOPWORDS and word.lower() not in terms:
            terms.append(word.lower())
    return terms[:8]


def gmail_query_for_question(scope, question):
    terms = natural_search_terms(question)
    return ' '.join([scope.strip(), *terms]).strip()


def is_credit_card_offer_question(question):
    terms = set(natural_search_terms(question))
    has_card_context = 'card' in terms or 'cards' in terms
    has_credit_context = 'credit' in terms or bool(re.search(r'\bcredit\s+cards?\b', question, re.I))
    offer_terms = {'offer', 'offers', 'deal', 'deals', 'promotion', 'promotions', 'promo',
                   'cashback', 'reward', 'rewards', 'discount', 'discounts', 'waive', 'waived',
                   'waiver', 'bonus', 'bonuses', 'perk', 'perks'}
    return has_card_context and has_credit_context and bool(terms & offer_terms)


def filter_credit_card_offer_evidence(question, evidence):
    """Keep only records with both card context and a concrete offer signal."""
    if not is_credit_card_offer_question(question):
        return evidence
    offer_pattern = re.compile(
        r'\b(?:offers?|deals?|promotions?|promos?|cash\s*back|rewards?|discounts?|'
        r'waiv(?:e|ed|er)|bonuses?|perks?)\b', re.I)
    card_pattern = re.compile(r'\b(?:credit\s+)?cards?\b', re.I)
    return [item for item in evidence
            if card_pattern.search(f'{item.title}\n{item.excerpt}')
            and offer_pattern.search(f'{item.title}\n{item.excerpt}')]


def drive_query_for_question(question):
    return ' '.join(natural_search_terms(question))
