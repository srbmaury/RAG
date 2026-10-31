# Document Q&A evaluation

Expected answers never enter the model prompt or retrieval index. Runs execute the production chat handler with normal workspace ownership and all workspace documents in scope, including the seeded distractor files.

**Run protocol:** The no-provider baseline returns excerpts only; its score measures whether relevant evidence was retrieved, not whether an answer was synthesized. The Ollama model completed a full 100-question pass; after general prompt and retrieval improvements, the initially flagged questions were rerun and their latest responses overlaid. The final Ollama file therefore contains one result per question, with a focused rerun for initially flagged cases.

**Scoring:** automated rubric checks required answer facts, cited-document coverage, source-ID validity, and whether required fact terms occur in the cited passages. This is a conservative regression check, not an independent semantic judge or proof that every claim is correct. Gold-page retrieval is reported separately. The dataset accepts documented paraphrases; missing synonyms can still cause false failures.

## baseline

Completed: 100/100. Automated rubric passes: 94/100. Errors: 0.

- comparison: 5/5
- fact: 59/59
- followup: 2/2
- reasoning: 24/25
- summary: 4/4
- unanswerable: 0/5

Flagged questions: Q060, Q096, Q097, Q098, Q099, Q100

## ollama

Completed: 100/100. Automated rubric passes: 100/100. Errors: 0.

- comparison: 5/5
- fact: 59/59
- followup: 2/2
- reasoning: 25/25
- summary: 4/4
- unanswerable: 5/5

Flagged questions: 
