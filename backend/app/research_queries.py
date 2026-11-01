"""Question parsing and conservative connected-source search filters."""

import re

QUERY_STOPWORDS = {
    'what',
    'which',
    'where',
    'when',
    'why',
    'how',
    'can',
    'could',
    'would',
    'should',
    'you',
    'please',
    'search',
    'searching',
    'look',
    'looking',
    'find',
    'list',
    'show',
    'tell',
    'me',
    'about',
    'the',
    'and',
    'or',
    'from',
    'to',
    'of',
    'a',
    'an',
    'my',
    'their',
    'our',
    'this',
    'that',
    'it',
    'all',
    'in',
    'on',
    'for',
    'are',
    'is',
    'was',
    'were',
    'does',
    'did',
    'with',
    'give',
    'summarize',
    'summary',
    'latest',
    'recent',
    'recently',
    'exact',
    'file',
    'files',
    'name',
    'names',
    'source',
    'sources',
    'any',
    'there',
    'have',
    'google',
    'drive',
    'gmail',
    'github',
    'slack',
    'email',
    'emails',
    'contain',
    'contains',
    'containing',
    'focus',
    'kind',
    'kinds',
    'available',
    'content',
    'contents',
    'item',
    'items',
    'unique',
    'marker',
    'scenario',
    'next',
    'upcoming',
    'calendar',
    'event',
    'events',
    'meeting',
    'meetings',
    'appointment',
    'appointments',
    'schedule',
    'schedules',
    'date',
    'dates',
    'time',
    'times',
    'tomorrow',
    'yesterday',
    'detail',
    'details',
    'page',
    'pages',
    'workspace',
    'across',
    'connected',
    'document',
    'documents',
    'uploaded',
    'upload',
}

GITHUB_QUERY_STOPWORDS = {
    'issues',
    'pull',
    'request',
    'requests',
    'pr',
    'prs',
    'repo',
    'open',
    'active',
    'unmerged',
    'get',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'different',
    'types',
    'type',
    'projects',
    'project',
    'repositories',
    'repository',
    'repos',
    'describe',
    'overview',
    'portfolio',
    'updated',
}
SLACK_QUERY_STOPWORDS = {
    'team',
    'discuss',
    'discussed',
    'decision',
    'decisions',
    'cite',
    'messages',
    'message',
}
CALENDAR_QUERY_STOPWORDS = {
    'today',
    'tonight',
    'tomorrow',
    'yesterday',
    'next',
    'upcoming',
    'soon',
}


def natural_search_terms(question, *, extra_stopwords=()):
    requested_counts = {
        match.group(1).lower()
        for match in re.finditer(
            r'\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+'
            r'(?:events?|appointments?|meetings?|messages?|emails?|documents?|files?|results?|items?)\b',
            question,
            re.I,
        )
    }
    terms = []
    for word in re.findall(r'[A-Za-z0-9_+.#-]{2,}', question):
        word = word.strip('._-+#')
        if not word:
            continue
        lowered = word.lower()
        if (
            lowered not in QUERY_STOPWORDS
            and lowered not in extra_stopwords
            and lowered not in requested_counts
            and lowered not in terms
        ):
            terms.append(word.lower())
    return terms[:8]


def gmail_query_for_question(scope, question):
    terms = natural_search_terms(question)
    return ' '.join([scope.strip(), *terms]).strip()


def is_credit_card_offer_question(question):
    terms = set(natural_search_terms(question))
    has_card_context = 'card' in terms or 'cards' in terms
    has_credit_context = 'credit' in terms or bool(
        re.search(r'\bcredit\s+cards?\b', question, re.I)
    )
    offer_terms = {
        'offer',
        'offers',
        'deal',
        'deals',
        'promotion',
        'promotions',
        'promo',
        'cashback',
        'reward',
        'rewards',
        'discount',
        'discounts',
        'waive',
        'waived',
        'waiver',
        'bonus',
        'bonuses',
        'perk',
        'perks',
    }
    return has_card_context and has_credit_context and bool(terms & offer_terms)


def filter_credit_card_offer_evidence(question, evidence):
    """Keep only records with both card context and a concrete offer signal."""
    if not is_credit_card_offer_question(question):
        return evidence
    offer_pattern = re.compile(
        r'\b(?:offers?|deals?|promotions?|promos?|cash\s*back|rewards?|discounts?|'
        r'waiv(?:e|ed|er)|bonuses?|perks?)\b',
        re.I,
    )
    card_pattern = re.compile(r'\b(?:credit\s+)?cards?\b', re.I)
    return [
        item
        for item in evidence
        if card_pattern.search(f'{item.title}\n{item.excerpt}')
        and offer_pattern.search(f'{item.title}\n{item.excerpt}')
    ]


def drive_query_for_question(question):
    return ' '.join(natural_search_terms(question))


def provider_query_terms(question, *, limit=8, extra_stopwords=()):
    """Return concise lexical terms for providers without a natural-language parser."""
    return natural_search_terms(question, extra_stopwords=extra_stopwords)[:limit]
