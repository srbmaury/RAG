"""Curated questions/answers. Evidence must be found in the indexed documents."""
import json
import re
from pathlib import Path
from app.db import Session,Document,Chunk

WID='4bdfe9c3-987c-49a9-bd9b-86bf6b8ea913'
items=[]
def add(doc,q,a,anchor,checks,kind='fact',history=None):
    items.append(dict(document=doc,question=q,expected_answer=a,anchor=anchor,required=checks,category=kind,history=history or []))
F='FreeEdit_Improvements_README.md'
add(F,'What is the main goal of the FreeEdit improvement proposal?','Make recording cleanup and shareable export dependable and frictionless without becoming a bloated video editor.','Turn FreeEdit into a dependable',[['recording','cleanup'],['export'],['bloated','focused','simple']],'summary')
add(F,'Which new feature has P0 priority in the FreeEdit plan?','One-click silence removal.','P0 — One-click silence removal',[['silence'],['removal','remove']])
add(F,'Should FreeEdit automatically apply silence-removal cuts without preview?','No. Show suggested segments and let the user inspect, adjust, and disable proposed cuts before export.','do not silently apply destructive cuts',[['preview','inspect'],['disable','toggle','opt out','adjust']],'reasoning')
add(F,'What controls should FreeEdit expose for silence detection?','Threshold, minimum silence duration, and padding around spoken sections.','user-adjustable threshold',[['threshold'],['duration'],['padding']])
add(F,'Why does FreeEdit prefer opaque masks for confidential text?','Blur or pixelation may not reliably protect secrets; solid redaction is preferred.','blur/pixelation may not reliably protect secrets',[['blur','pixelation'],['opaque','solid','redaction'],['secret','confidential']],'reasoning')
add(F,'Which starter export presets are proposed for FreeEdit?','Balanced, Small file, High quality, and Audio only.','| Balanced |',[['balanced'],['small file'],['high quality'],['audio only']])
add(F,'What is FreeEdit’s north-star metric?','Percentage of successful uploads that produce an exported file.','North-star metric',[['upload'],['export'],['percentage','proportion','rate']])
add(F,'Which P0 reliability action does FreeEdit prescribe to keep abandoned uploads from filling disk?','Run scheduled, job-aware temporary-file cleanup independently of new uploads.','| P0 | Temporary files |',[['scheduled'],['job-aware','job aware'],['cleanup'],['independent']],'summary')
add(F,'What work does FreeEdit plan in each of its three build phases?','First harden existing behavior; then detect and remove silence; then add privacy masking and export presets.','Phase 1 — Make existing FreeEdit dependable',[['reliab','dependable','harden'],['silence','silent','pause'],['mask','privacy'],['preset','sharing']],'summary')
add(F,'Does FreeEdit require sign-in for basic edits, and is cloud collaboration in scope for its first release?','No. Basic edits should not require sign-in, and cloud collaboration is out of scope.','Explicitly out of scope',[['no','not','avoid','out of scope'],['sign','account'],['collaboration']],'reasoning')
S='Standalone_Project_Ideas_README.md'
add(S,'How many standalone open-source project ideas are proposed?','Seven ideas.','Seven Practical Open-Source Project Ideas',[['seven','7']])
add(S,'What does GhostLayer do?','Inspect files for hidden metadata, allow selective cleanup, verify the result, and download a cleaned copy.','Know what a file reveals',[['metadata','hidden'],['clean','remov'],['verif']])
add(S,'What are DiffPaper’s expected input and output?','Two PDFs—original and revised—go in; highlighted changes and an annotated comparison report with page references come out.','Upload original + revised PDF',[['pdf'],['original','two'],['report','comparison'],['page','highlight']])
add(S,'What export formats are in the TableLift MVP?','CSV, JSON, and XLSX.','Export CSV, JSON, and XLSX.',[['csv'],['json'],['xlsx']])
add(S,'What privacy controls should ProofPack provide before exporting a bug report?','Opt-in capture, minimal safe data collection, and user review/redaction of sensitive data.','Review and redact captured sensitive information.',[['opt','consent'],['redact'],['minimal','sensitive','privacy']],'reasoning')
add(S,'How does NearDrop verify completed file transfers?','Using a cryptographic hash/checksum.','Verify completed files with a cryptographic hash.',[['hash','checksum']])
add(S,'Why does SubShift use two anchor points rather than only one offset?','Two anchors correct linear timing drift; a constant offset cannot fix progressive drift.','Use two anchor points to adjust linear timing drift.',[['two'],['drift'],['offset']],'reasoning')
add(S,'After FormForge fills a PDF, are the entered fields left as editable form controls or flattened into the exported file?','The entered content is flattened into a downloadable PDF.','Flatten entered content into a downloadable PDF.',[['pdf'],['flatten']])
add(S,'Which project ideas are described as the strongest technical-depth options?','DiffPaper, ProofPack, and NearDrop.','Strongest technical depth',[['diffpaper'],['proofpack'],['neardrop']])
add(S,'Is the four-week project schedule a guaranteed delivery estimate?','No. It is illustrative, not a promise for every project.','illustrative schedule, not a promise',[['illustrative'],['not','no'],['promise','guarantee']],'reasoning')
P='EvalcueAI_Payment_Gateway_Options.md'
add(P,'According to the payment-options note, which provider should an individual investigate first, and why is it a fit for EvalcueAI?','PayU, because it explicitly offers an Individual entity category.','PayU is a strong first option to investigate',[['payu'],['individual']])
add(P,'In the EvalcueAI payment-options note, what three personal documents are listed for PayU Individual onboarding, and what name must the bank account match?','Personal PAN, address proof, and bank-account proof; the bank-account name must match the PAN holder.','personal PAN, address proof, and bank-account proof',[['pan'],['address'],['bank'],['match']])
add(P,'In the EvalcueAI payment-options note, what monthly limit is recorded for Paytm’s unregistered-business route?','The cited guidance records ₹50,000 per month; current terms need rechecking.','₹50,000 monthly limit',[['50,000','50000'],['month']])
add(P,'Why could the recorded Paytm route be unsuitable for immediately usable revenue?','The note says settlements are held until business documents are provided, alongside the recorded monthly limit.','hold on settlements until business documents',[['settlement'],['held','hold'],['business document','business documents']],'reasoning')
add(P,'What possible business proofs are mentioned for Cashfree?','Udyam/MSME or Shop & Establishment documentation; a GST self-declaration may apply where GST does not.','Udyam/MSME or Shop & Establishment',[['udyam','msme'],['shop'],['gst']])
add(P,'Does the note say that Udyam registration guarantees payment-gateway approval?','No. Eligibility and provider acceptance must be checked independently; registration does not guarantee approval.','Registration does not guarantee gateway approval.',[['no','not'],['guarantee'],['approval']],'reasoning')
add(P,'In the EvalcueAI payment-options note, does the Stripe email prove that every applicant needs all three of PAN, GSTIN, and CIN, or do documents depend on the entity?','No. The applicable documents depend on the entity; mentioning them does not mean all three are required for every applicant.','does **not** establish that every applicant must supply all three',[['no','not'],['entity','depend'],['every applicant']],'reasoning')
add(P,'Which payment features should EvalcueAI verify before choosing a provider?','Checkout, subscriptions/automatic renewals, UPI, cards, webhooks, refunds, international support, fees, limits, and settlement timing.','one-time checkout, subscriptions or automatic renewals',[['subscription','renew'],['upi'],['webhook'],['refund'],['settlement']],'summary')
add(P,'Does the payment gateway note contain the underlying provider article URLs, and what source material does it say the earlier discussion provided instead?','No. The original discussion named providers but did not include the underlying article URLs.','did not include the underlying article URLs',[['no','not'],['url','link']])
add(P,'What warning does the EvalcueAI payment-options note give about applying its September 2026 pricing and onboarding details today?','It is a dated discussion record; provider terms can change, so verify current provider documentation and written onboarding terms.','Notes from the prior discussion, September 2026',[['change'],['current','confirm','verify'],['provider']],'reasoning')
J='README-improved.md'
add(J,'Who is the Target-Company SDE Scanner designed for?','Software-engineering candidates with roughly 1–3 years of experience.','1–3 years of experience',[['1','one'],['3','three'],['experience']])
add(J,'How many target companies does the scanner README say it searches?','More than 300 target companies.','300+ target companies',[['300']])
add(J,'What are the two ways to use the job scanner?','The jobbot CLI and an AI-assistant skill for conversational use.','Two ways to use it',[['cli'],['skill']])
add(J,'Does jobbot automatically submit job applications?','No. It stops before final submission for explicit user review/action.','jobbot never submits an application without your explicit action',[['no','not','never'],['submit','submission'],['user','explicit','review']],'reasoning')
add(J,'What happens to job ranking if Ollama is unavailable?','It falls back to keyword matching.','Without it, jobbot falls back to keyword matching.',[['keyword']])
add(J,'Which command checks jobbot’s profile, resumes, Playwright, Ollama, and tracker setup?','./jobbot.sh doctor.','./jobbot.sh doctor',[['doctor']])
add(J,'What Gmail permission does jobbot use, and can it modify messages?','gmail.readonly. It does not send, label, delete, or modify messages.','Gmail access is **read-only**',[['read-only','readonly'],['not','no','cannot'],['send','modify','delete']])
add(J,'Where does jobbot keep its private profile and local application tracker?','The private profile is profile.yaml, which is git-ignored; the tracker is under ~/.jobbot/.','Local profile:',[['profile.yaml'],['.jobbot']])
add(J,'What does the jobbot --dry-run flag do?','Fills and validates applications without submitting or recording them.','--dry-run       Fill and validate without submitting or recording',[['fill'],['validat'],['without','not'],['record']])
add(J,'What ranking scale does jobbot use, and how does it choose a resume variant?','Each role is scored 0–100 against every resume variant, and the best variant is selected.','0–100',[['0','zero'],['100'],['resume'],['best','highest']])
A='Africa.pdf'
add(A,'According to the Africa volume, how many widely recognised sovereign countries receive complete chapters?','54 countries.','All 54 widely recognised sovereign countries',[['54']])
add(A,'Why does the Africa book give Western Sahara a separate section?','Its sovereignty is disputed; it is separate from the 54 widely recognised sovereign-country chapters.','Western Sahara has a separate section',[['disput'],['separate']],'reasoning')
add(A,'Why does the Africa book’s country count differ from African Union membership?','The AU includes the Sahrawi Arab Democratic Republic, while the book treats Western Sahara separately.','it includes the Sahrawi Arab Democratic Republic',[['sahrawi'],['western sahara']],'reasoning')
add(A,'What date and rounding convention are used for population figures in the Africa volume?','UN mid-2025 estimates, rounded to the nearest thousand.','UN mid-2025 estimates rounded to the nearest thousand',[['2025'],['thousand'],['estimate']])
add(A,'Which two countries use broad geographic regions in the Africa book’s administrative directories?','Uganda and Botswana.','Uganda and Botswana use broad geographic regions',[['uganda'],['botswana']])
add(A,'What administrative framework does the Africa book use for Libya?','A clearly dated historical district framework, rather than a complete current local-council directory.','Libya uses a clearly dated historical district framework',[['historical'],['district'],['2007']])
add(A,'Does the Africa volume have a printed index, and how can readers jump to chapters?','There is no printed index; PDF bookmarks open chapters and major sections.','There is no printed index.',[['no','not'],['bookmark']])
add(A,'Does a map colour in the Africa volume establish a legal ruling on disputed sovereignty?','No. Disputed borders and claims are explained; map colour alone is not a legal ruling.','map colour alone should not be read as a legal ruling',[['no','not'],['legal']],'reasoning')
add(A,'Which source supplies the India outline in the Africa book’s world locators?','The official Survey of India international outline.','official Survey of India international outline',[['survey of india']])
add(A,'What can numbered points represent in the Africa volume when reliable updated boundary shapes are unavailable?','They can locate an administrative division, rather than necessarily its capital; locator points replace older boundaries.','Numbered points may locate a division rather than its capital.',[['division'],['capital'],['point']],'reasoning')
AS='Asia.pdf'
add(AS,'How many country chapters does the Asia book contain, and why is this more than its UN geographic grouping count?','49 chapters: the UN Asian grouping has 48 countries in this treatment, and Russia is added.','This gives 49 country chapters.',[['49'],['48'],['russia']],'reasoning')
add(AS,'How is Taiwan covered in the Asia volume?','A separate full profile explains self-government and disputed international status.','Taiwan receives a separate full profile',[['separate'],['self-government','self government'],['disput']])
add(AS,'Are Hong Kong and Macao counted separately in the Asia volume’s 48-country UN grouping?','No; they are covered within China for that grouping.','Hong Kong and Macao are covered within China',[['china'],['within','not','no']])
add(AS,'Why is Russia included in the Asia volume?','Most of its territory lies in Asia.','Russia is added because most of its territory lies in Asia.',[['territory'],['asia']],'reasoning')
add(AS,'Which population reference date and source does the Asia book use for Taiwan?','Official household-registration count at 31 December 2025.','official household-registration count at 31 December 2025',[['household'],['31'],['december'],['2025']])
add(AS,'Does the Asia book’s UN population figure for China include the same statistical series as Hong Kong and Macao?','No. The China figure is the mainland series; Hong Kong and Macao have separate statistical series.','China’s UN figure is the mainland series',[['mainland'],['separate']],'reasoning')
add(AS,'What administrative level does the Asia directory use for Singapore?','Planning regions.','Singapore uses planning regions',[['planning'],['region']])
add(AS,'What directory does the Asia volume use for the Maldives after its 2026 local-government changes?','A geographic atoll directory.','The Maldives uses a geographic atoll directory',[['atoll'],['geographic']])
add(AS,'What is the capital and currency of Laos according to the Asia book?','Vientiane and the Lao kip.','Capital Vientiane',[['vientiane'],['kip']])
add(AS,'Does appearing in both the Asia and Europe volumes necessarily mean a country was mistakenly duplicated?','No. Transcontinental countries can appear in more than one volume where useful.','Transcontinental countries appear in more than one continental volume',[['transcontinental'],['more than one','both','multiple']],'reasoning')
E='Europe.pdf'
add(E,'How many country chapters does the Europe volume include, and what separate profile does it also contain?','50 chapters, plus a separate Kosovo profile.','This makes 50 country chapters.',[['50'],['kosovo']])
add(E,'In the Europe volume’s scope note, how many sovereign countries in the UN European geographic grouping form the core before other countries are added?','44 sovereign countries.','The 44 sovereign countries',[['44']])
add(E,'Which six countries are added to Europe’s UN geographic grouping in this book?','Türkiye, Cyprus, Georgia, Armenia, Azerbaijan, and Kazakhstan.','Türkiye, Cyprus, Georgia, Armenia, Azerbaijan and Kazakhstan',[['türkiye','turkey'],['cyprus'],['georgia'],['armenia'],['azerbaijan'],['kazakhstan']])
add(E,'Why does the Europe volume give Kosovo a separate profile?','Its disputed recognition is explained separately.','Kosovo receives a separate profile',[['disput'],['recognition']],'reasoning')
add(E,'What population date and source does the Europe book use for France?','INSEE’s 1 January 2026 estimate.','INSEE’s 1 January 2026 estimate',[['insee'],['january'],['2026']])
add(E,'What resident-count date is used for Vatican City in the Europe volume?','31 December 2024.','Vatican City uses its 31 December 2024',[['31'],['december'],['2024']])
add(E,'What is the reference date for government descriptions in the Europe volume?','11 October 2026.','Government descriptions have a reference date of 11 October 2026.',[['11'],['october'],['2026']])
add(E,'What is the Netherlands’ capital, and where do its government and parliament sit?','Amsterdam is the capital; government and parliament sit in The Hague.','Amsterdam is the capital. Government and parliament sit in The Hague.',[['amsterdam'],['hague']])
add(E,'Which languages are listed for Belgium in the Europe identity panel?','Dutch, French, and German.','Dutch, French and German',[['dutch'],['french'],['german']])
add(E,'Are the Europe book’s maps intended to show military control in Ukraine, and what border status do they show instead?','No. Ukraine is shown within internationally recognised borders; the maps are geographic references, not military-control maps.','not military control maps',[['no','not'],['international'],['border']],'reasoning')
N='North_America.pdf'
add(N,'How many sovereign countries does the North America volume include?','23 sovereign countries.','23 sovereign countries',[['23']])
add(N,'Which geographic areas are included in the North America book’s definition?','Canada, the United States, Mexico, Central America, and the Caribbean.','This book uses a broad geographic definition',[['canada'],['united states'],['mexico'],['central america'],['caribbean']])
add(N,'Are Greenland and Puerto Rico counted among North America’s 23 sovereign countries? State how the volume classifies them.','No. Non-sovereign places are covered separately.','Greenland, Puerto Rico and other non-sovereign places',[['no','not'],['non-sovereign','territor'],['separate','not counted among','excluded from']],'reasoning')
add(N,'Which city is Canada’s national capital, and how does the volume distinguish Toronto?','Ottawa; Toronto is the largest city, not the national capital.','OTTAWA IS THE CAPITAL',[['ottawa'],['toronto'],['largest']])
add(N,'What are Canada’s federal official languages according to its identity panel?','English and French.','Federal official languages English and French',[['english'],['french']])
add(N,'What currency does it use?','Canada uses the Canadian dollar (CAD).','Canadian dollar (CAD)',[['canadian dollar','cad']],'followup',[{'role':'user','content':'What are Canada’s federal official languages?'},{'role':'assistant','content':'Canada’s federal official languages are English and French.'}])
add(N,'What does Canada’s flag’s eleven-point maple leaf represent according to the book?','The eleven points are a design choice; they do not represent provinces.','The eleven points are a design choice',[['design'],['not'],['province']],'reasoning')
add(N,'What is the national capital of the United States, and why is it different from Washington state?','Washington, D.C. is the national capital; Washington state is a different place on the Pacific coast.','Washington, D.C. is the national capital.',[['washington'],['d.c.','dc'],['state'],['pacific']])
add(N,'What do the fifty stars and thirteen stripes on the US flag represent?','Fifty states and the original thirteen colonies.','The fifty stars represent the fifty states.',[['fifty','50'],['state'],['thirteen','13'],['colon']])
add(N,'Which two countries share Hispaniola in the North America volume?','Haiti and the Dominican Republic.','Haiti and the Dominican Republic share Hispaniola.',[['haiti'],['dominican']])
O='Ocenia.pdf'
add(O,'How many UN-member country chapters does the Oceania volume contain?','Fourteen chapters.','fourteen chapters for Oceania’s UN-member countries',[['fourteen','14']])
add(O,'How does the Oceania book classify the Cook Islands and Niue?','Self-governing states in free association with New Zealand, not ordinary dependent territories.','self-governing states in free association with New Zealand',[['self-governing','self governing'],['free association'],['new zealand']])
add(O,'How many different images does each Oceania country chapter have, and what roles do they serve?','Three: an opener, a history illustration, and a culture or daily-life image.','Every country has three different images',[['three','3'],['opener'],['history'],['culture','daily']])
add(O,'Are the Oceania book’s images generated scenes or reused between country chapters?','No. They are identified historical documents or photographs, with credits, and are not reused between chapters.','Images are not generated scenes.',[['not','no'],['generated'],['reused','reuse']])
add(O,'Which population date is used for Samoa instead of a UN mid-2025 estimate?','Its official November 2021 census.','Samoa’s official November 2021 census',[['november'],['2021'],['census']])
add(O,'Why do the Oceania maps carry longitudes eastward beyond 180 degrees, and does this change island locations or political status?','To keep Pacific islands together rather than splitting them at the map edge; their locations and political status do not change.','longitudes eastward beyond 180 degrees',[['island'],['split','edge','together'],['not','without','unchanged']],'reasoning')
add(O,'Are the large dots on the small Pacific islands drawn to represent true land area, and why are they enlarged?','No. Markers are deliberately larger than the land to make islands findable; insets use different scales.','dots are deliberately larger than the land',[['no','not'],['larger','enlarged'],['find','visible','locat','readab']],'reasoning')
add(O,'What is Australia’s capital and currency in the Oceania identity panel?','Canberra and the Australian dollar.','Capital Canberra',[['canberra'],['australian dollar']])
add(O,'What is Australia’s administrative directory level—how many states and main territories does it cover?','Australia’s directory covers eight states and main territories: six states plus two main territories.','Directory level 8 states and main territories (6 + 2)',[['eight','8'],['six','6'],['two','2']],'followup',[{'role':'user','content':'What is Australia’s capital and currency?'},{'role':'assistant','content':'Australia’s capital is Canberra and its currency is the Australian dollar.'}])
add(O,'What three broad Pacific regions does the Oceania overview name alongside Australia and New Zealand?','Melanesia, Micronesia, and Polynesia.','Melanesia, Micronesia and Polynesia',[['melanesia'],['micronesia'],['polynesia']])
# Cross-document reasoning deliberately goes beyond single-passage lookup.
add([AS,E],'Which overlap between the Asia and Europe volumes explains why their chapter totals cannot be added to count unique countries?','Transcontinental countries can appear in both volumes, so summing chapter totals double-counts countries.','Transcontinental countries appear in more than one continental volume',[['transcontinental'],['both','overlap','duplicate','double','more than one']],'comparison')
add([A,N],'How do the Africa and North America volumes distinguish sovereign countries from disputed or non-sovereign places?','Africa has 54 country chapters and a separate disputed Western Sahara section; North America has 23 sovereign chapters and separate non-sovereign places such as Greenland and Puerto Rico.','All 54 widely recognised sovereign countries',[['54'],['western sahara'],['23'],['greenland','puerto rico']],'comparison')
add([F,S],'How do FreeEdit and the standalone-project document agree on product scope?','Both favor a focused, complete first-session workflow with a useful output, without mandatory accounts or platform/social expansion.','Avoid accounts, social features, collaboration systems',[['focused','one job','one problem','single'],['account','sign-up','sign up'],['output','export','workflow']],'comparison')
add([S,J],'How do NearDrop and jobbot keep users in control of consequential actions?','NearDrop requires receiver approval for a transfer; jobbot leaves final application submission to explicit user action.','Receiver approves',[['receiver','recipient'],['approv'],['submit','submission'],['explicit','user']],'comparison')
add([P,J],'Compare individual payment-gateway onboarding with jobbot application submission: which approval or user action is still required in each?','Gateway onboarding still requires KYC; jobbot still needs the user to explicitly submit the final application.','No company registration',[['kyc'],['submit','submission'],['user','explicit','human']],'comparison')
for q in [
 'What is Saurabh’s private bank-account number in these documents?',
 'How many FreeEdit users paid for the product yesterday?',
 'What is the guaranteed current PayU fee for every EvalcueAI transaction?',
 'What job offers has the owner actually received this week?',
 'What is the exact population of every African country today, rather than the book’s dated estimates?']:
 add([],q,'The supplied documents do not establish this. State the limitation instead of inventing an answer.',None,[],'unanswerable')


def norm(s): return re.sub(r'\s+',' ',s).strip().casefold()

def build():
    assert len(items)==100,len(items)
    with Session() as db:
        docs={d.name:d for d in db.query(Document).filter_by(workspace_id=WID,status='ready')}
        for i,item in enumerate(items,1):
            item['id']=f'Q{i:03d}'
            names=item['document'] if isinstance(item['document'],list) else [item['document']]
            evidence=[]
            for name in names:
                chunks=db.query(Chunk).filter_by(document_id=docs[name].id).order_by(Chunk.ordinal).all()
                matches=[c for c in chunks if item['anchor'] and norm(item['anchor']) in norm(c.text)]
                # Cross-document secondary evidence is selected independently using reviewed anchors below.
                if not matches and len(names)>1:
                    anchors={E:'The 44 sovereign countries',N:'23 sovereign countries',S:'No forced sign-up',J:'jobbot never submits an application without your explicit action'}
                    anchor=anchors.get(name)
                    matches=[c for c in chunks if anchor and norm(anchor) in norm(c.text)]
                if not matches: raise ValueError(f"{item['id']}: missing evidence {name}: {item['anchor']}")
                c=matches[0]
                evidence.append({'document':name,'document_id':docs[name].id,'chunk_id':c.id,'page':c.page,'text':c.text})
            item['evidence']=evidence
        output={'version':1,'workspace_id':WID,'scope':'Nine user-supplied documents visible in the active workspace; excludes the two seeded demo files. Questions and expected answers are curated, not generated from app responses.','questions':items}
        Path('evals/questions.json').write_text(json.dumps(output,indent=2,ensure_ascii=False))
        print('Wrote',len(items),'questions')
if __name__=='__main__':build()
