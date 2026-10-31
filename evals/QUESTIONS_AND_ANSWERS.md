# 100 document-grounded questions and reference answers

Nine user-supplied documents visible in the active workspace; excludes the two seeded demo files. Questions and expected answers are curated, not generated from app responses.

These reference answers are curated from the documents, independent of app responses. Financial/provider statements describe the September 2026 note and are not verified current onboarding advice. PDF statements follow each book’s edition and geographic scope.

## Q001: What is the main goal of the FreeEdit improvement proposal?

**Type:** summary

**Reference answer:** Make recording cleanup and shareable export dependable and frictionless without becoming a bloated video editor.

**Source:** FreeEdit_Improvements_README.md, section 1; chunk `773737fe-b622-473c-8ac2-8077768da60b`.

## Q002: Which new feature has P0 priority in the FreeEdit plan?

**Type:** fact

**Reference answer:** One-click silence removal.

**Source:** FreeEdit_Improvements_README.md, section 1; chunk `773737fe-b622-473c-8ac2-8077768da60b`.

## Q003: Should FreeEdit automatically apply silence-removal cuts without preview?

**Type:** reasoning

**Reference answer:** No. Show suggested segments and let the user inspect, adjust, and disable proposed cuts before export.

**Source:** FreeEdit_Improvements_README.md, section 1; chunk `eb647d42-e024-4eb8-91b4-c57bb6d31bed`.

## Q004: What controls should FreeEdit expose for silence detection?

**Type:** fact

**Reference answer:** Threshold, minimum silence duration, and padding around spoken sections.

**Source:** FreeEdit_Improvements_README.md, section 1; chunk `eb647d42-e024-4eb8-91b4-c57bb6d31bed`.

## Q005: Why does FreeEdit prefer opaque masks for confidential text?

**Type:** reasoning

**Reference answer:** Blur or pixelation may not reliably protect secrets; solid redaction is preferred.

**Source:** FreeEdit_Improvements_README.md, section 1; chunk `e6260d62-e967-4597-adf1-179744724188`.

## Q006: Which starter export presets are proposed for FreeEdit?

**Type:** fact

**Reference answer:** Balanced, Small file, High quality, and Audio only.

**Source:** FreeEdit_Improvements_README.md, section 1; chunk `e6260d62-e967-4597-adf1-179744724188`.

## Q007: What is FreeEdit’s north-star metric?

**Type:** fact

**Reference answer:** Percentage of successful uploads that produce an exported file.

**Source:** FreeEdit_Improvements_README.md, section 1; chunk `773737fe-b622-473c-8ac2-8077768da60b`.

## Q008: Which P0 reliability action does FreeEdit prescribe to keep abandoned uploads from filling disk?

**Type:** summary

**Reference answer:** Run scheduled, job-aware temporary-file cleanup independently of new uploads.

**Source:** FreeEdit_Improvements_README.md, section 1; chunk `79d4f561-9043-4501-93ba-785683cfba90`.

## Q009: What work does FreeEdit plan in each of its three build phases?

**Type:** summary

**Reference answer:** First harden existing behavior; then detect and remove silence; then add privacy masking and export presets.

**Source:** FreeEdit_Improvements_README.md, section 1; chunk `ebfd7266-049c-4407-9784-a207421c93f3`.

## Q010: Does FreeEdit require sign-in for basic edits, and is cloud collaboration in scope for its first release?

**Type:** reasoning

**Reference answer:** No. Basic edits should not require sign-in, and cloud collaboration is out of scope.

**Source:** FreeEdit_Improvements_README.md, section 1; chunk `c59e207d-5521-4f07-8bb0-79f9f468b67b`.

## Q011: How many standalone open-source project ideas are proposed?

**Type:** fact

**Reference answer:** Seven ideas.

**Source:** Standalone_Project_Ideas_README.md, section 1; chunk `70bb7536-0229-43b4-8fa3-8ee6a6a30c91`.

## Q012: What does GhostLayer do?

**Type:** fact

**Reference answer:** Inspect files for hidden metadata, allow selective cleanup, verify the result, and download a cleaned copy.

**Source:** Standalone_Project_Ideas_README.md, section 1; chunk `70bb7536-0229-43b4-8fa3-8ee6a6a30c91`.

## Q013: What are DiffPaper’s expected input and output?

**Type:** fact

**Reference answer:** Two PDFs—original and revised—go in; highlighted changes and an annotated comparison report with page references come out.

**Source:** Standalone_Project_Ideas_README.md, section 1; chunk `79c4f578-ac18-4057-a0e9-8ee8d0a791ec`.

## Q014: What export formats are in the TableLift MVP?

**Type:** fact

**Reference answer:** CSV, JSON, and XLSX.

**Source:** Standalone_Project_Ideas_README.md, section 1; chunk `0e92d750-bc0b-410a-8154-09e7d786bfa5`.

## Q015: What privacy controls should ProofPack provide before exporting a bug report?

**Type:** reasoning

**Reference answer:** Opt-in capture, minimal safe data collection, and user review/redaction of sensitive data.

**Source:** Standalone_Project_Ideas_README.md, section 1; chunk `4480e5f1-2cc2-4ec5-bcdd-277bf7d95e6f`.

## Q016: How does NearDrop verify completed file transfers?

**Type:** fact

**Reference answer:** Using a cryptographic hash/checksum.

**Source:** Standalone_Project_Ideas_README.md, section 1; chunk `681e36c0-f305-430d-a50c-2d9363b0bbb4`.

## Q017: Why does SubShift use two anchor points rather than only one offset?

**Type:** reasoning

**Reference answer:** Two anchors correct linear timing drift; a constant offset cannot fix progressive drift.

**Source:** Standalone_Project_Ideas_README.md, section 1; chunk `681e36c0-f305-430d-a50c-2d9363b0bbb4`.

## Q018: After FormForge fills a PDF, are the entered fields left as editable form controls or flattened into the exported file?

**Type:** fact

**Reference answer:** The entered content is flattened into a downloadable PDF.

**Source:** Standalone_Project_Ideas_README.md, section 1; chunk `e4ae7ab5-a7fe-4621-b4ea-b698cb1fdf3b`.

## Q019: Which project ideas are described as the strongest technical-depth options?

**Type:** fact

**Reference answer:** DiffPaper, ProofPack, and NearDrop.

**Source:** Standalone_Project_Ideas_README.md, section 1; chunk `e4ae7ab5-a7fe-4621-b4ea-b698cb1fdf3b`.

## Q020: Is the four-week project schedule a guaranteed delivery estimate?

**Type:** reasoning

**Reference answer:** No. It is illustrative, not a promise for every project.

**Source:** Standalone_Project_Ideas_README.md, section 1; chunk `3c0623ed-a09c-4ad7-aa0f-e5aa7de7a78c`.

## Q021: According to the payment-options note, which provider should an individual investigate first, and why is it a fit for EvalcueAI?

**Type:** fact

**Reference answer:** PayU, because it explicitly offers an Individual entity category.

**Source:** EvalcueAI_Payment_Gateway_Options.md, section 1; chunk `50a1293f-b39f-4215-af35-4f6af9cc83bd`.

## Q022: In the EvalcueAI payment-options note, what three personal documents are listed for PayU Individual onboarding, and what name must the bank account match?

**Type:** fact

**Reference answer:** Personal PAN, address proof, and bank-account proof; the bank-account name must match the PAN holder.

**Source:** EvalcueAI_Payment_Gateway_Options.md, section 1; chunk `50a1293f-b39f-4215-af35-4f6af9cc83bd`.

## Q023: In the EvalcueAI payment-options note, what monthly limit is recorded for Paytm’s unregistered-business route?

**Type:** fact

**Reference answer:** The cited guidance records ₹50,000 per month; current terms need rechecking.

**Source:** EvalcueAI_Payment_Gateway_Options.md, section 1; chunk `50a1293f-b39f-4215-af35-4f6af9cc83bd`.

## Q024: Why could the recorded Paytm route be unsuitable for immediately usable revenue?

**Type:** reasoning

**Reference answer:** The note says settlements are held until business documents are provided, alongside the recorded monthly limit.

**Source:** EvalcueAI_Payment_Gateway_Options.md, section 1; chunk `194cf8e0-be03-4d19-aa97-74c9d12f6dba`.

## Q025: What possible business proofs are mentioned for Cashfree?

**Type:** fact

**Reference answer:** Udyam/MSME or Shop & Establishment documentation; a GST self-declaration may apply where GST does not.

**Source:** EvalcueAI_Payment_Gateway_Options.md, section 1; chunk `50a1293f-b39f-4215-af35-4f6af9cc83bd`.

## Q026: Does the note say that Udyam registration guarantees payment-gateway approval?

**Type:** reasoning

**Reference answer:** No. Eligibility and provider acceptance must be checked independently; registration does not guarantee approval.

**Source:** EvalcueAI_Payment_Gateway_Options.md, section 1; chunk `194cf8e0-be03-4d19-aa97-74c9d12f6dba`.

## Q027: In the EvalcueAI payment-options note, does the Stripe email prove that every applicant needs all three of PAN, GSTIN, and CIN, or do documents depend on the entity?

**Type:** reasoning

**Reference answer:** No. The applicable documents depend on the entity; mentioning them does not mean all three are required for every applicant.

**Source:** EvalcueAI_Payment_Gateway_Options.md, section 1; chunk `a2524ed7-23e9-439c-9861-152a9638698e`.

## Q028: Which payment features should EvalcueAI verify before choosing a provider?

**Type:** summary

**Reference answer:** Checkout, subscriptions/automatic renewals, UPI, cards, webhooks, refunds, international support, fees, limits, and settlement timing.

**Source:** EvalcueAI_Payment_Gateway_Options.md, section 1; chunk `a2524ed7-23e9-439c-9861-152a9638698e`.

## Q029: Does the payment gateway note contain the underlying provider article URLs, and what source material does it say the earlier discussion provided instead?

**Type:** fact

**Reference answer:** No. The original discussion named providers but did not include the underlying article URLs.

**Source:** EvalcueAI_Payment_Gateway_Options.md, section 1; chunk `7699fa49-c0c5-40bb-a735-c809f2e9e661`.

## Q030: What warning does the EvalcueAI payment-options note give about applying its September 2026 pricing and onboarding details today?

**Type:** reasoning

**Reference answer:** It is a dated discussion record; provider terms can change, so verify current provider documentation and written onboarding terms.

**Source:** EvalcueAI_Payment_Gateway_Options.md, section 1; chunk `50a1293f-b39f-4215-af35-4f6af9cc83bd`.

## Q031: Who is the Target-Company SDE Scanner designed for?

**Type:** fact

**Reference answer:** Software-engineering candidates with roughly 1–3 years of experience.

**Source:** README-improved.md, section 1; chunk `4ce3fd37-0f87-4758-beb8-7bbc3a5b880e`.

## Q032: How many target companies does the scanner README say it searches?

**Type:** fact

**Reference answer:** More than 300 target companies.

**Source:** README-improved.md, section 1; chunk `4ce3fd37-0f87-4758-beb8-7bbc3a5b880e`.

## Q033: What are the two ways to use the job scanner?

**Type:** fact

**Reference answer:** The jobbot CLI and an AI-assistant skill for conversational use.

**Source:** README-improved.md, section 1; chunk `4ce3fd37-0f87-4758-beb8-7bbc3a5b880e`.

## Q034: Does jobbot automatically submit job applications?

**Type:** reasoning

**Reference answer:** No. It stops before final submission for explicit user review/action.

**Source:** README-improved.md, section 1; chunk `4ce3fd37-0f87-4758-beb8-7bbc3a5b880e`.

## Q035: What happens to job ranking if Ollama is unavailable?

**Type:** fact

**Reference answer:** It falls back to keyword matching.

**Source:** README-improved.md, section 1; chunk `e67b6c54-66ef-4a65-af92-7416906de4a6`.

## Q036: Which command checks jobbot’s profile, resumes, Playwright, Ollama, and tracker setup?

**Type:** fact

**Reference answer:** ./jobbot.sh doctor.

**Source:** README-improved.md, section 1; chunk `3a23fc07-42a9-4bd3-93f6-ebe296fcee1a`.

## Q037: What Gmail permission does jobbot use, and can it modify messages?

**Type:** fact

**Reference answer:** gmail.readonly. It does not send, label, delete, or modify messages.

**Source:** README-improved.md, section 1; chunk `78e4d2a1-d591-432a-9248-fe898a271e03`.

## Q038: Where does jobbot keep its private profile and local application tracker?

**Type:** fact

**Reference answer:** The private profile is profile.yaml, which is git-ignored; the tracker is under ~/.jobbot/.

**Source:** README-improved.md, section 1; chunk `9d4d65c5-0374-48a4-8d2d-449a0fc8d64f`.

## Q039: What does the jobbot --dry-run flag do?

**Type:** fact

**Reference answer:** Fills and validates applications without submitting or recording them.

**Source:** README-improved.md, section 1; chunk `17c73ecb-2d20-431b-af4b-2a33e57dbe48`.

## Q040: What ranking scale does jobbot use, and how does it choose a resume variant?

**Type:** fact

**Reference answer:** Each role is scored 0–100 against every resume variant, and the best variant is selected.

**Source:** README-improved.md, section 1; chunk `e67b6c54-66ef-4a65-af92-7416906de4a6`.

## Q041: According to the Africa volume, how many widely recognised sovereign countries receive complete chapters?

**Type:** fact

**Reference answer:** 54 countries.

**Source:** Africa.pdf, page 2; chunk `07b174b6-db7a-4451-9ee2-7759f9df7fdc`.

## Q042: Why does the Africa book give Western Sahara a separate section?

**Type:** reasoning

**Reference answer:** Its sovereignty is disputed; it is separate from the 54 widely recognised sovereign-country chapters.

**Source:** Africa.pdf, page 2; chunk `07b174b6-db7a-4451-9ee2-7759f9df7fdc`.

## Q043: Why does the Africa book’s country count differ from African Union membership?

**Type:** reasoning

**Reference answer:** The AU includes the Sahrawi Arab Democratic Republic, while the book treats Western Sahara separately.

**Source:** Africa.pdf, page 2; chunk `07b174b6-db7a-4451-9ee2-7759f9df7fdc`.

## Q044: What date and rounding convention are used for population figures in the Africa volume?

**Type:** fact

**Reference answer:** UN mid-2025 estimates, rounded to the nearest thousand.

**Source:** Africa.pdf, page 2; chunk `07b174b6-db7a-4451-9ee2-7759f9df7fdc`.

## Q045: Which two countries use broad geographic regions in the Africa book’s administrative directories?

**Type:** fact

**Reference answer:** Uganda and Botswana.

**Source:** Africa.pdf, page 2; chunk `07b174b6-db7a-4451-9ee2-7759f9df7fdc`.

## Q046: What administrative framework does the Africa book use for Libya?

**Type:** fact

**Reference answer:** A clearly dated historical district framework, rather than a complete current local-council directory.

**Source:** Africa.pdf, page 2; chunk `07b174b6-db7a-4451-9ee2-7759f9df7fdc`.

## Q047: Does the Africa volume have a printed index, and how can readers jump to chapters?

**Type:** fact

**Reference answer:** There is no printed index; PDF bookmarks open chapters and major sections.

**Source:** Africa.pdf, page 2; chunk `c9b88318-bb7e-4f2f-aaed-264dd3c76a89`.

## Q048: Does a map colour in the Africa volume establish a legal ruling on disputed sovereignty?

**Type:** reasoning

**Reference answer:** No. Disputed borders and claims are explained; map colour alone is not a legal ruling.

**Source:** Africa.pdf, page 2; chunk `07b174b6-db7a-4451-9ee2-7759f9df7fdc`.

## Q049: Which source supplies the India outline in the Africa book’s world locators?

**Type:** fact

**Reference answer:** The official Survey of India international outline.

**Source:** Africa.pdf, page 2; chunk `07b174b6-db7a-4451-9ee2-7759f9df7fdc`.

## Q050: What can numbered points represent in the Africa volume when reliable updated boundary shapes are unavailable?

**Type:** reasoning

**Reference answer:** They can locate an administrative division, rather than necessarily its capital; locator points replace older boundaries.

**Source:** Africa.pdf, page 2; chunk `07b174b6-db7a-4451-9ee2-7759f9df7fdc`.

## Q051: How many country chapters does the Asia book contain, and why is this more than its UN geographic grouping count?

**Type:** reasoning

**Reference answer:** 49 chapters: the UN Asian grouping has 48 countries in this treatment, and Russia is added.

**Source:** Asia.pdf, page 2; chunk `33d86ad0-5be1-48be-883b-745ded2c4f12`.

## Q052: How is Taiwan covered in the Asia volume?

**Type:** fact

**Reference answer:** A separate full profile explains self-government and disputed international status.

**Source:** Asia.pdf, page 2; chunk `33d86ad0-5be1-48be-883b-745ded2c4f12`.

## Q053: Are Hong Kong and Macao counted separately in the Asia volume’s 48-country UN grouping?

**Type:** fact

**Reference answer:** No; they are covered within China for that grouping.

**Source:** Asia.pdf, page 2; chunk `33d86ad0-5be1-48be-883b-745ded2c4f12`.

## Q054: Why is Russia included in the Asia volume?

**Type:** reasoning

**Reference answer:** Most of its territory lies in Asia.

**Source:** Asia.pdf, page 2; chunk `33d86ad0-5be1-48be-883b-745ded2c4f12`.

## Q055: Which population reference date and source does the Asia book use for Taiwan?

**Type:** fact

**Reference answer:** Official household-registration count at 31 December 2025.

**Source:** Asia.pdf, page 2; chunk `33d86ad0-5be1-48be-883b-745ded2c4f12`.

## Q056: Does the Asia book’s UN population figure for China include the same statistical series as Hong Kong and Macao?

**Type:** reasoning

**Reference answer:** No. The China figure is the mainland series; Hong Kong and Macao have separate statistical series.

**Source:** Asia.pdf, page 2; chunk `33d86ad0-5be1-48be-883b-745ded2c4f12`.

## Q057: What administrative level does the Asia directory use for Singapore?

**Type:** fact

**Reference answer:** Planning regions.

**Source:** Asia.pdf, page 2; chunk `33d86ad0-5be1-48be-883b-745ded2c4f12`.

## Q058: What directory does the Asia volume use for the Maldives after its 2026 local-government changes?

**Type:** fact

**Reference answer:** A geographic atoll directory.

**Source:** Asia.pdf, page 2; chunk `33d86ad0-5be1-48be-883b-745ded2c4f12`.

## Q059: What is the capital and currency of Laos according to the Asia book?

**Type:** fact

**Reference answer:** Vientiane and the Lao kip.

**Source:** Asia.pdf, page 170; chunk `d196a9d0-5f26-42ba-af32-12e1c7465ddb`.

## Q060: Does appearing in both the Asia and Europe volumes necessarily mean a country was mistakenly duplicated?

**Type:** reasoning

**Reference answer:** No. Transcontinental countries can appear in more than one volume where useful.

**Source:** Asia.pdf, page 2; chunk `33d86ad0-5be1-48be-883b-745ded2c4f12`.

## Q061: How many country chapters does the Europe volume include, and what separate profile does it also contain?

**Type:** fact

**Reference answer:** 50 chapters, plus a separate Kosovo profile.

**Source:** Europe.pdf, page 2; chunk `a7a1d36b-1958-40b4-9cb9-db6c7ccb9f47`.

## Q062: In the Europe volume’s scope note, how many sovereign countries in the UN European geographic grouping form the core before other countries are added?

**Type:** fact

**Reference answer:** 44 sovereign countries.

**Source:** Europe.pdf, page 2; chunk `a7a1d36b-1958-40b4-9cb9-db6c7ccb9f47`.

## Q063: Which six countries are added to Europe’s UN geographic grouping in this book?

**Type:** fact

**Reference answer:** Türkiye, Cyprus, Georgia, Armenia, Azerbaijan, and Kazakhstan.

**Source:** Europe.pdf, page 2; chunk `a7a1d36b-1958-40b4-9cb9-db6c7ccb9f47`.

## Q064: Why does the Europe volume give Kosovo a separate profile?

**Type:** reasoning

**Reference answer:** Its disputed recognition is explained separately.

**Source:** Europe.pdf, page 2; chunk `a7a1d36b-1958-40b4-9cb9-db6c7ccb9f47`.

## Q065: What population date and source does the Europe book use for France?

**Type:** fact

**Reference answer:** INSEE’s 1 January 2026 estimate.

**Source:** Europe.pdf, page 2; chunk `a7a1d36b-1958-40b4-9cb9-db6c7ccb9f47`.

## Q066: What resident-count date is used for Vatican City in the Europe volume?

**Type:** fact

**Reference answer:** 31 December 2024.

**Source:** Europe.pdf, page 2; chunk `a7a1d36b-1958-40b4-9cb9-db6c7ccb9f47`.

## Q067: What is the reference date for government descriptions in the Europe volume?

**Type:** fact

**Reference answer:** 11 October 2026.

**Source:** Europe.pdf, page 2; chunk `a7a1d36b-1958-40b4-9cb9-db6c7ccb9f47`.

## Q068: What is the Netherlands’ capital, and where do its government and parliament sit?

**Type:** fact

**Reference answer:** Amsterdam is the capital; government and parliament sit in The Hague.

**Source:** Europe.pdf, page 31; chunk `4f0f19c8-637b-42bd-86d8-7a57b9ecf0ca`.

## Q069: Which languages are listed for Belgium in the Europe identity panel?

**Type:** fact

**Reference answer:** Dutch, French, and German.

**Source:** Europe.pdf, page 20; chunk `52715604-df94-48b6-b5ac-bb04834fbf0e`.

## Q070: Are the Europe book’s maps intended to show military control in Ukraine, and what border status do they show instead?

**Type:** reasoning

**Reference answer:** No. Ukraine is shown within internationally recognised borders; the maps are geographic references, not military-control maps.

**Source:** Europe.pdf, page 2; chunk `a7a1d36b-1958-40b4-9cb9-db6c7ccb9f47`.

## Q071: How many sovereign countries does the North America volume include?

**Type:** fact

**Reference answer:** 23 sovereign countries.

**Source:** North_America.pdf, page 1; chunk `feeba573-cbaf-433c-8bfb-494450cfd9ef`.

## Q072: Which geographic areas are included in the North America book’s definition?

**Type:** fact

**Reference answer:** Canada, the United States, Mexico, Central America, and the Caribbean.

**Source:** North_America.pdf, page 2; chunk `4f871b27-f9e1-417f-9afa-85f8c76b0751`.

## Q073: Are Greenland and Puerto Rico counted among North America’s 23 sovereign countries? State how the volume classifies them.

**Type:** reasoning

**Reference answer:** No. Non-sovereign places are covered separately.

**Source:** North_America.pdf, page 2; chunk `4f871b27-f9e1-417f-9afa-85f8c76b0751`.

## Q074: Which city is Canada’s national capital, and how does the volume distinguish Toronto?

**Type:** fact

**Reference answer:** Ottawa; Toronto is the largest city, not the national capital.

**Source:** North_America.pdf, page 6; chunk `1847810f-ab9f-4cab-a7af-dc6ab425ec69`.

## Q075: What are Canada’s federal official languages according to its identity panel?

**Type:** fact

**Reference answer:** English and French.

**Source:** North_America.pdf, page 6; chunk `1847810f-ab9f-4cab-a7af-dc6ab425ec69`.

## Q076: What currency does it use?

**Type:** followup

**Reference answer:** Canada uses the Canadian dollar (CAD).

**Source:** North_America.pdf, page 6; chunk `1847810f-ab9f-4cab-a7af-dc6ab425ec69`.

**Conversation context:** [{"role": "user", "content": "What are Canada’s federal official languages?"}, {"role": "assistant", "content": "Canada’s federal official languages are English and French."}]

## Q077: What does Canada’s flag’s eleven-point maple leaf represent according to the book?

**Type:** reasoning

**Reference answer:** The eleven points are a design choice; they do not represent provinces.

**Source:** North_America.pdf, page 6; chunk `1847810f-ab9f-4cab-a7af-dc6ab425ec69`.

## Q078: What is the national capital of the United States, and why is it different from Washington state?

**Type:** fact

**Reference answer:** Washington, D.C. is the national capital; Washington state is a different place on the Pacific coast.

**Source:** North_America.pdf, page 26; chunk `ddd57f38-2edd-4a06-ae28-f102f7d6d7e2`.

## Q079: What do the fifty stars and thirteen stripes on the US flag represent?

**Type:** fact

**Reference answer:** Fifty states and the original thirteen colonies.

**Source:** North_America.pdf, page 26; chunk `ddd57f38-2edd-4a06-ae28-f102f7d6d7e2`.

## Q080: Which two countries share Hispaniola in the North America volume?

**Type:** fact

**Reference answer:** Haiti and the Dominican Republic.

**Source:** North_America.pdf, page 4; chunk `6c826522-683f-4b07-8ef2-c0b2dee3c45c`.

## Q081: How many UN-member country chapters does the Oceania volume contain?

**Type:** fact

**Reference answer:** Fourteen chapters.

**Source:** Ocenia.pdf, page 2; chunk `50d5d701-0767-4ff8-ae15-2eb12dd9d4cd`.

## Q082: How does the Oceania book classify the Cook Islands and Niue?

**Type:** fact

**Reference answer:** Self-governing states in free association with New Zealand, not ordinary dependent territories.

**Source:** Ocenia.pdf, page 2; chunk `50d5d701-0767-4ff8-ae15-2eb12dd9d4cd`.

## Q083: How many different images does each Oceania country chapter have, and what roles do they serve?

**Type:** fact

**Reference answer:** Three: an opener, a history illustration, and a culture or daily-life image.

**Source:** Ocenia.pdf, page 2; chunk `50d5d701-0767-4ff8-ae15-2eb12dd9d4cd`.

## Q084: Are the Oceania book’s images generated scenes or reused between country chapters?

**Type:** fact

**Reference answer:** No. They are identified historical documents or photographs, with credits, and are not reused between chapters.

**Source:** Ocenia.pdf, page 2; chunk `50d5d701-0767-4ff8-ae15-2eb12dd9d4cd`.

## Q085: Which population date is used for Samoa instead of a UN mid-2025 estimate?

**Type:** fact

**Reference answer:** Its official November 2021 census.

**Source:** Ocenia.pdf, page 2; chunk `50d5d701-0767-4ff8-ae15-2eb12dd9d4cd`.

## Q086: Why do the Oceania maps carry longitudes eastward beyond 180 degrees, and does this change island locations or political status?

**Type:** reasoning

**Reference answer:** To keep Pacific islands together rather than splitting them at the map edge; their locations and political status do not change.

**Source:** Ocenia.pdf, page 2; chunk `50d5d701-0767-4ff8-ae15-2eb12dd9d4cd`.

## Q087: Are the large dots on the small Pacific islands drawn to represent true land area, and why are they enlarged?

**Type:** reasoning

**Reference answer:** No. Markers are deliberately larger than the land to make islands findable; insets use different scales.

**Source:** Ocenia.pdf, page 2; chunk `50d5d701-0767-4ff8-ae15-2eb12dd9d4cd`.

## Q088: What is Australia’s capital and currency in the Oceania identity panel?

**Type:** fact

**Reference answer:** Canberra and the Australian dollar.

**Source:** Ocenia.pdf, page 8; chunk `f42378f6-6c0a-4086-9210-64f229b44a5b`.

## Q089: What is Australia’s administrative directory level—how many states and main territories does it cover?

**Type:** followup

**Reference answer:** Australia’s directory covers eight states and main territories: six states plus two main territories.

**Source:** Ocenia.pdf, page 8; chunk `f42378f6-6c0a-4086-9210-64f229b44a5b`.

**Conversation context:** [{"role": "user", "content": "What is Australia’s capital and currency?"}, {"role": "assistant", "content": "Australia’s capital is Canberra and its currency is the Australian dollar."}]

## Q090: What three broad Pacific regions does the Oceania overview name alongside Australia and New Zealand?

**Type:** fact

**Reference answer:** Melanesia, Micronesia, and Polynesia.

**Source:** Ocenia.pdf, page 3; chunk `d231f899-c74e-414c-915a-93dc846e8ec8`.

## Q091: Which overlap between the Asia and Europe volumes explains why their chapter totals cannot be added to count unique countries?

**Type:** comparison

**Reference answer:** Transcontinental countries can appear in both volumes, so summing chapter totals double-counts countries.

**Source:** Asia.pdf, page 2; chunk `33d86ad0-5be1-48be-883b-745ded2c4f12`.

**Source:** Europe.pdf, page 2; chunk `a7a1d36b-1958-40b4-9cb9-db6c7ccb9f47`.

## Q092: How do the Africa and North America volumes distinguish sovereign countries from disputed or non-sovereign places?

**Type:** comparison

**Reference answer:** Africa has 54 country chapters and a separate disputed Western Sahara section; North America has 23 sovereign chapters and separate non-sovereign places such as Greenland and Puerto Rico.

**Source:** Africa.pdf, page 2; chunk `07b174b6-db7a-4451-9ee2-7759f9df7fdc`.

**Source:** North_America.pdf, page 1; chunk `feeba573-cbaf-433c-8bfb-494450cfd9ef`.

## Q093: How do FreeEdit and the standalone-project document agree on product scope?

**Type:** comparison

**Reference answer:** Both favor a focused, complete first-session workflow with a useful output, without mandatory accounts or platform/social expansion.

**Source:** FreeEdit_Improvements_README.md, section 1; chunk `773737fe-b622-473c-8ac2-8077768da60b`.

**Source:** Standalone_Project_Ideas_README.md, section 1; chunk `70bb7536-0229-43b4-8fa3-8ee6a6a30c91`.

## Q094: How do NearDrop and jobbot keep users in control of consequential actions?

**Type:** comparison

**Reference answer:** NearDrop requires receiver approval for a transfer; jobbot leaves final application submission to explicit user action.

**Source:** Standalone_Project_Ideas_README.md, section 1; chunk `4480e5f1-2cc2-4ec5-bcdd-277bf7d95e6f`.

**Source:** README-improved.md, section 1; chunk `4ce3fd37-0f87-4758-beb8-7bbc3a5b880e`.

## Q095: Compare individual payment-gateway onboarding with jobbot application submission: which approval or user action is still required in each?

**Type:** comparison

**Reference answer:** Gateway onboarding still requires KYC; jobbot still needs the user to explicitly submit the final application.

**Source:** EvalcueAI_Payment_Gateway_Options.md, section 1; chunk `194cf8e0-be03-4d19-aa97-74c9d12f6dba`.

**Source:** README-improved.md, section 1; chunk `4ce3fd37-0f87-4758-beb8-7bbc3a5b880e`.

## Q096: What is Saurabh’s private bank-account number in these documents?

**Type:** unanswerable

**Reference answer:** The supplied documents do not establish this. State the limitation instead of inventing an answer.

## Q097: How many FreeEdit users paid for the product yesterday?

**Type:** unanswerable

**Reference answer:** The supplied documents do not establish this. State the limitation instead of inventing an answer.

## Q098: What is the guaranteed current PayU fee for every EvalcueAI transaction?

**Type:** unanswerable

**Reference answer:** The supplied documents do not establish this. State the limitation instead of inventing an answer.

## Q099: What job offers has the owner actually received this week?

**Type:** unanswerable

**Reference answer:** The supplied documents do not establish this. State the limitation instead of inventing an answer.

## Q100: What is the exact population of every African country today, rather than the book’s dated estimates?

**Type:** unanswerable

**Reference answer:** The supplied documents do not establish this. State the limitation instead of inventing an answer.
