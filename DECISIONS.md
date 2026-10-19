# DECISIONS: conflicts, additions and defaults

This file goes with `SPEC.md`. It has three parts:

1. **Conflicts** between the build request and the proposal. The proposal wins, and each item says what I did.
2. **Requirements found in the proposal that the build request does not mention.** I plan to include P1–P4. P5 is a question.
3. **Open points**: things neither document settles, each with the default I chose. Most defaults can be changed in Settings. Every one of them will be described in the app's README sheet so you can cite it in the methods chapter.

Items marked **❓** need your answer before I start milestone 2. The rest go ahead as written unless you object.

---

## 1. Conflicts between the build request and the proposal

| # | Build request says | Proposal says | What I did |
|---|---|---|---|
| **C1** ❓ | "Project file (.json): the full state, re-importable." | «فایل کلید تطبیق کد و هویت، جدا از داده‌ها نگهداری می‌شود» (۹–۴). The key linking codes to identities is kept **separate from the data**. | **Proposal followed.** Names, contact details and notes live in a separate identity store. The project `.json` contains **everything except** that store. A second export, «فایل کلید هویت» (`…_identity-key.json`), holds code → name/contact/notes and can be imported back. Restoring a full backup takes both files. The private expert screen shows names only when the key is loaded. |
| **C2** | Sensitivity analysis: "option to always run it (on by default)". | Run it «چنانچه اختلاف امتیاز وزنی دو کانسپت برتر کمتر از ۱۰% دامنه‌ی مقیاس باشد». Conditional. | Not a strict contradiction, because running more analysis does not change a decision. I kept your default. Every report states «شرط اجرای تحلیل حساسیت طبق پروپوزال: برقرار است / برقرار نیست». When the condition is not met, the results are labelled «تکمیلی (خارج از شرط پروپوزال)». |
| **C3** | Everything (scale, thresholds, scores…) editable at any time, including after a round is closed. | «تعیین پیشاپیش تعداد دورها و معیار اجماع، از الزامات گزارش‌دهی معتبر دلفی است». Criteria are fixed in advance. | Editing is allowed, as you asked. The app **snapshots the settings** when the first round-1 response arrives. Any later change to the scale, bands or thresholds is logged with before/after and an optional reason. The thesis report then shows a boxed note listing every deviation from the snapshot, so a reader can see that the criteria were changed after data collection. Nothing is hidden. |
| **C4** | The app computes everything. | «محاسبات وزن و امتیاز با Microsoft Excel» (و). Variables table: «محاسبه با Excel». | The app computes, and the Excel export writes **live formulas** (COUNTIFS, QUARTILE.INC, MEDIAN, AVERAGE, SUMPRODUCT…) next to cached values, so every number can be recalculated in Excel. You may want one sentence in the methods chapter naming the app as the tool and Excel as the verification. |
| **C5** | Optional «توانایی قضاوت ندارم» option, on by default. | The questionnaire is described without such an option. The consensus percentages are over «پاسخ‌های معتبر» (valid responses). | Kept (on by default). It fits the "valid responses" wording: "cannot judge" is not valid and is left out of the denominators. Because it changes the instrument the proposal describes, you may want to mention it in the methods. |
| **C6** | Report Wᵢ (implied 0–1, since ΣWᵢ = 1 is checked). | Table ۷–۴, variable ۴, gives the unit as «عدد بدون واحد (۰ تا ۱00)», but the method text says «مجموع وزن‌های نهایی نیز برابر ۱ است». The proposal is inconsistent with itself here. | Computed on the 0–1 scale (relations ۱–۵ govern). The design brief shows **both** Wᵢ (Σ = 1) and Wᵢ × 100 (Σ = 100), which satisfies both readings. |
| **C7** | Relation ۵ "generalise to any number of domains". | Relation ۵ is written as "÷ ۳" over the three named domains (relation ۷ likewise). | The mean over K domains. For K = 3 the result is identical. Not a conflict; noted for traceability. |

---

## 2. Requirements in the proposal that the build request does not mention

| # | Proposal | Plan |
|---|---|---|
| **P1** | «رضایت آگاهانه در ابتدای پرسش‌نامه و پیش از نمایش پرسش‌ها اخذ می‌شود» | Every expert file (round 1, round 2, weighted-Pugh scoring) opens with a consent page. The text is editable in Settings, and the default is drafted from ۹–۴, including the commitment to take part in all rounds. Questions appear only after the expert ticks «موافقم». The response file stores `consent.given` and its time. With manual entry or spreadsheet import, you tick consent per expert. |
| **P2** | «پاسخ‌های دورهای تکمیل‌شده پیش از انصراف، تنها در صورت عدم مخالفت فرد در تحلیل همان دورها باقی می‌ماند» | Expert status «انصراف» (with date) **keeps** earlier answers by default. A separate checkbox, «با استفاده از پاسخ‌های قبلی مخالف است», removes all of that expert's data from every analysis. The app first previews what will change (for example "P07 changes from retain to no consensus"). |
| **P3** | Separate key file. | See C1. |
| **P4** | «نقل‌قول از پاسخ‌های باز، بدون جزئیات هویت‌بخش ارائه می‌گردد» | Each open answer has the original text (researcher view only) and an editable «متن قابل‌انتشار» (display text) that starts as a copy. Exports and reports use only the display text. |
| **P5** ❓ | Inclusion criteria per domain, e.g. surgeons need «دست‌کم ۵ سال تجربه در مداخلات درون‌عروقی…». | **Not built unless you say yes.** Option: a per-domain "minimum years" setting (default 5 for surgery, empty for the others) that warns when an expert falls below it, plus a per-expert checkbox «معیارهای ورود احراز شد». Small, but it is beyond your feature list, so I'm asking first. |

Out of scope (Phase 1/4 or not software): the supervisors' clarity review of the items, invitation letters, the morphological chart, and the Phase-4 compliance table.

---

## 3. Open points and chosen defaults

### 3.1 Numbers and statistics

| ID | Open point | Default |
|---|---|---|
| D-01 | Quartile method | Hyndman–Fan type 7 = Excel `QUARTILE.INC` = R `quantile(type = 7)`, everywhere (SPEC § 1.3). With n = 1, Q1 = Q3 = median and IQR = 0. With n = 0, all are shown as «—». |
| D-02 | How IQR is reported | As «میانه (Q1–Q3)» plus the IQR value (Q3 − Q1). The proposal's own Table ۳ uses this form («میانه ۱۷ نفر (چارک اول ۱۱، چارک سوم ۳۱)»). |
| D-03 | Rounding | Full precision in every calculation and decision. Display only: percentages to 1 decimal, weights to 4 decimals, scores to 2 decimals. Excel stores unrounded values with number formats. |
| D-04 | Threshold arithmetic | Integer: `count·10000 ≥ round(pct·100)·n`. Exact for thresholds with ≤ 2 decimals (SPEC § 1.4). |
| D-05 | Tolerance for "Σ = 1" and score ties | `1e-9`. |

### 3.2 Experts, identities, statuses

| ID | Open point | Default |
|---|---|---|
| D-06 | Code format | `E01`, `E02`, … in creation order, padded to 3 digits once there are more than 99 experts. Codes are editable and must be unique. A deleted expert's code is **not reused automatically**, so it cannot clash with files already sent out. |
| D-07 | Deactivate vs delete vs withdraw | *Deactivate* stops future invitations and keeps the data. *Withdraw* records the status with its date and keeps the data unless P2's objection box is ticked. *Delete* shows every response and score that would go, then removes it (undo available). |
| D-08 | Who counts as a round-1 respondent | An expert not excluded under P2 who has a round-1 response with **at least one answer** (a rating or "cannot judge"). The same definition applies to round 2. A response containing only blanks counts as not responding. The status badge is set automatically on import and can be corrected by hand. |
| D-09 | "Type of activity" | Free text with suggestions (بالینی / دانشگاهی / صنعتی / پژوهشی), reported as frequency and %. |
| D-10 | Experience bands for the panel description | Edges 5, 10, 15, 20 (<5, 5–9, 10–14, 15–19, ≥20), editable. Median (Q1–Q3) overall and per domain. Minimum, maximum and individual values never appear. |

### 3.3 Scale and consensus

| ID | Open point | Default |
|---|---|---|
| D-11 | Thresholds edited so that "retain" and "remove" could both be true (only possible at ≤ 50 %) | Settings shows an error. A parameter that meets both is reported as «فاقد اجماع (تعارض معیارها)». |
| D-12 | No valid answers for a parameter (n = 0) | «فاقد اجماع», flagged «بدون پاسخ معتبر». |
| D-13 | Scale edits after data exist | Preview first: "N answers fall outside the new range and will become invalid". If applied, those answers are kept in storage but treated as blank, so undoing the edit restores them. Bands must be contiguous and cover the range (SPEC A3). A scale with more than 3 bands is allowed; the consensus rule then reads only the first and last band. |
| D-13b | Labels | Defaults are «کم‌اهمیت / مهم اما نه حیاتی / حیاتی» and «توانایی قضاوت ندارم», all editable. The 5-level value scale for Part B also has editable labels, defaulting to the proposal's wording, including «بسیار خوب (نزدیک به حالت ایدئال)». |

### 3.4 Round 1, open answers and new parameters

| ID | Open point | Default |
|---|---|---|
| D-14 | Is the 20 % rule automatic, or does the team decide? | The proposal says candidates at or above 20 % «… به فهرست دور دوم افزوده می‌شوند», so candidates **at or above the threshold are added by default** and those below are not. You can override either way, but the override needs a written reason, is logged, and appears in the round-1 report as a deviation. |
| D-15 | Denominator of the 20 % | All round-1 respondents (D-08), not only the experts who wrote open text. |
| D-16 | Counting support | Distinct experts after synonym merges. An expert who raises the same idea in two groups counts once. An open answer can be tagged with several candidates, or marked "comment only". |
| D-17 | Tagging to an existing parameter | Recorded as a comment or support for that parameter (shown in the round-1 report). It creates nothing new. |
| D-18 | Where a new parameter goes | You give each added candidate a code, name, «الزام طراحی», explanation and semantic group (existing or new) before round-2 files are generated. Its origin is «افزوده‌شده در دور دوم». A new group created this way takes part in the group-level allocation. |

### 3.5 Round 2 and allocation

| ID | Open point | Default |
|---|---|---|
| D-19 | Who is invited to round 2 | Round-1 respondents who have not withdrawn. Editable per expert. |
| D-20 | Contents of the feedback | Per domain: % in each band (of valid round-1 answers) and n valid, in the domain's colour with its short label, plus the expert's own round-1 answer highlighted (a number, «توانایی قضاوت ندارم» or «پاسخ نداده‌اید»). There is no overall row, because the proposal specifies «به تفکیک هر حوزه تخصصی». Data from experts excluded under P2 is left out. |
| D-21 | Blank vs 0 in allocations | Within a level where the expert entered at least one number, a blank counts as 0. A level with no entries at all counts as not completed. Negative numbers are rejected on entry. Decimals are accepted. |
| D-22 | An expert gives a group positive points but 0 to **every retained** parameter in it (relation ۱ would be 0 ÷ 0) | That group is treated **as if it had no retained parameter for that expert**: it leaves that expert's relation ۲ denominator and its points are spread over the expert's other groups in proportion. This applies the proposal's own logic («سهم … به نسبت نظر همان خبره میان عناصر باقی‌مانده بازتوزیع می‌شود») and keeps Σ = 1. Shown as a warning that names the expert and the group. |
| D-23 | When an expert counts as having "not completed" the allocation | Excluded if there is no allocation, if the group level is blank, if a group with a retained parameter and positive points has a blank parameter level, or if every group with a retained parameter got 0 points. The weights screen lists the excluded experts with the reason. |
| D-24 | Totals ≠ 100 | Warning only, no blocking (as you asked, and as the proposal says: «انحراف جزئی از مجموع ۱۰۰ بر وزن‌ها اثری ندارد»). Any total above 0 is accepted. |

### 3.6 Consensus, weights and the design brief

| ID | Open point | Default |
|---|---|---|
| D-25 | Panel minimum check | Counted on round-2 respondents, total and per domain, against 9 / 3. A failed check is a red banner on the round-2 analysis and weights screens and a note in the report. It **warns, not blocks**: the proposal says the minimum «بررسی می‌شود» but does not say what happens if it fails. |
| D-26 | A domain with **no valid allocator** | Relation ۵ is averaged over the domains that have at least one, so ΣW = 1 still holds because each domain vector sums to 1. Red warning, and the report states «میانگین روی K = ۲ حوزه به‌دلیل نبود داده در حوزه …». |
| D-27 | A domain with no experts at all (e.g. a 4th domain added but empty) | Same rule as D-26, shown as an informational notice rather than "missing data". |
| D-28 | Population for the agreement IQR | All included experts pooled (as the proposal describes, «وزن‌های کلی فردی»). The Excel weights sheet also gives per-domain Q1/Q3. |
| D-29 | Parameters in the brief | Retained only, ordered by Wᵢ descending (the order can be switched to group/code). Removed and no-consensus parameters go in two separate tables with their round-2 band percentages. |
| D-30 | No parameter retained | Weights are not computed, and a message explains why. |

### 3.7 Pugh screening

| ID | Open point | Default |
|---|---|---|
| D-31 | Matrix orientation | Rows are parameters, columns are concepts, and the datum column is labelled «مرجع». |
| D-32 | Meaning of «رأی اکثریت» | **Plurality**: the symbol with the most votes wins. A tie for the most votes gives `S`, per «در صورت تساوی آرا، S ثبت می‌شود». Missing votes are ignored. A cell with no votes at all is empty, is not counted, and triggers a warning that the run is incomplete. Single-rater mode uses that rater's symbol directly. |
| D-33 | Which raters | 1–4 named raters (default: پژوهشگر، استاد راهنما، استاد مشاور). The researcher **does** rate here, as the proposal assigns screening to the team. |
| D-34 | Run 1, "best" | The highest net score among the run-1 survivors **and the datum** (net 0). If several tie, the app flags it and you pick. The default is the first in display order. |
| D-35 | Run 2, compared set | Run-1 survivors plus the run-1 datum, minus the best (which becomes the datum). Infeasible concepts are still screened so they appear in the report, but they cannot be forwarded. |
| D-36 ❓ | Run 2, a concept that is **all S** against the best | It has no "−", so it is not dominated, and it has no "+", so it has no «مزیت متمایز». **Default: not forwarded**, with status «معادل کانسپت برتر، بدون مزیت متمایز». This is the literal reading: only «کانسپت برتر و کانسپت‌های حفظ‌شده» go forward, and «حفظ» requires at least one "+". You can override per concept with a reason. |
| D-37 | More than 4, and the best's place | The **best always takes one of the 4 places**. The other ≤ 3 are the kept concepts with the highest run-2 net scores. A tie at the cutoff is flagged and you choose (default: display order). |
| D-38 ❓ | The "at least two" safety rule | The proposal's literal trigger is "the best dominates all the others". I **generalised** it to "fewer than 2 would be forwarded for any reason", which also covers a lone all-S concept (D-36) or infeasible kept concepts. The extra concept is the feasible, not-yet-forwarded one with the highest run-2 net score. The report says which trigger fired. |
| D-39 | Feasibility vs the cap of 4 | Infeasible concepts are removed **before** the cap is applied. If the best itself is infeasible, a red warning appears and the remaining concepts follow the same rules. |
| D-40 | The run-1 datum turns out to be the best | Run 2 has the same datum. The app copies the run-1 votes into run 2 automatically (with a notice) and applies the run-2 rules. |
| D-41 | Manual overrides | Any eliminate or forward decision can be overridden. A reason is required, the override is logged, and the report lists it next to the rule-based result. |

### 3.8 Weighted Pugh matrix and sensitivity

| ID | Open point | Default |
|---|---|---|
| D-42 | Raters | Round-2 respondents (D-08) not excluded under P2, each with their domain. Experts can be added or removed by hand. The researcher is never a rater. |
| D-43 | Blinding | Each expert gets random concept codes (e.g. «طرح ۴۷», distinct two-digit numbers) and a random order, drawn from a stored seed so the file can be regenerated identically. The key stays in the app; import maps the codes back. The file shows only sketch, description and code, with no screening result, and every concept is presented in the same format. |
| D-44 | Missing scores | Left out of that domain's median. If a domain has no score for a cell, relation ۷ averages the domains that do (warning). If a cell has no score at all, that concept's weighted score is **incomplete and unranked** until it is filled. |
| D-45 | Ties in the ranking | Competition ranking (1, 1, 3) with `1e-9` tolerance. A tie for first is flagged. |
| D-46 | Weights not summing to 1 | Relation ۸ uses them as entered, with an amber warning and a «نرمال‌سازی» button. Sensitivity always starts from the normalised weights. |
| D-47 | Sensitivity trigger | Gap = (1st − 2nd) on unrounded scores. Triggered when gap < (10 % × (max − min)) − 1e-9, which is strict "less than". The percentage is editable. "Always run" is on (C2). Fewer than 2 ranked concepts means no sensitivity. |
| D-48 | What "the ranking changes" means | Reported twice: whether the **top concept** changed (or a tie appeared for first) and whether the **full order** changed. |
| D-49 | Break-even (build request) | Closed form (SPEC B8). For each parameter: the % change in its weight needed for 2nd to tie 1st, its direction, and "impossible" when it would need a change below −100 % or when the two concepts score equally on that parameter. It covers only the top-two pair, as requested. A third concept could overtake earlier, and the one-at-a-time table shows that case. |
| D-50 | Sensitivity step | ±20 % (proposal), editable. |
| D-51 | Link between Part A weights and Part B columns | "Send weights to Part B" **copies** the current Wᵢ and is logged. Your manual edits in Part B are kept. If Part A's weights later change, Part B shows «وزن‌های بخش الف تغییر کرده‌اند» with a one-click re-send. Nothing is overwritten silently. |

### 3.9 Files, editing, history

| ID | Open point | Default |
|---|---|---|
| D-52 | Response file | JSON `{schema, projectId, round, expertCode, answers…, consent, submittedAt, checksum}`. The checksum is SHA-256 of the canonical payload, computed with a small bundled pure-JS SHA-256 so it also works when the file is opened from disk. It detects corruption, not deliberate tampering. On import the app checks project, round, code, checksum and parameter IDs, and lists any mismatch before you confirm. |
| D-53 | Re-import for the same expert and round | A diff ("3 answers differ") and confirmation, then replace. Logged. |
| D-54 | Drafts in expert files | `localStorage` keyed by project, round and code. Caveat for your instructions to experts: some browsers (notably Safari) restrict storage for pages opened from disk, so the draft may not survive there. The final «ذخیره پاسخ» download always works. |
| D-55 | When "after data collection" starts | When the first round-1 response is stored. From then on every edit to setup, settings, answers or matrices goes into a persistent change log (time, item, before → after, optional reason), which can be exported to Excel. |
| D-56 | Undo/redo | In-memory history of the last 100 edits for the session, with Ctrl+Z / Ctrl+Y. Destructive actions also show an «بازگردانی» toast. The change log in D-55 is the permanent record; undo affects only the current session. |
| D-57 | Edits that affect entered data | Before applying, a dialog lists what will change (answers invalidated, parameters changing status, weights shifting, concepts re-ranked). Cancel or apply. |
| D-58 | Persian digits | Persian digits by default, with «٫» as the decimal separator and no thousands grouping. Toggle to Latin digits. Codes and English terms stay LTR. Excel and CSV always hold real numbers (Latin) so they stay machine-readable. The printable report follows the toggle. |
| D-59 | Charts | Hand-written SVG (no chart library), exported as SVG with the font embedded and as PNG at 2×. Each bar segment carries the domain's short label (ج / م / ا) as well as its colour, and every chart has a legend. Default palette (Okabe–Ito, colour-blind safe): surgery `#0072B2` blue, engineering `#E69F00` orange, ergonomics `#009E73` green. |
| D-60 | Excel formulas | Formulas where they help a reviewer retrace the numbers: COUNTIFS for band counts, percentages, consensus IF, relations ۱–۵ referencing the allocations sheet, QUARTILE.INC, MEDIAN/AVERAGE/SUMPRODUCT for relations ۶–۸. Cached values are written too, so the file reads correctly before recalculation. Sheets are right-to-left. A README sheet explains every sheet. |
| D-61 | Captions | Numbered Persian captions in the report («جدول ۱ – …», «نمودار ۱ – …»), editable. |
| D-62 | Demo project | Fictional, with codes only and names like «خبره نمونه ۱». It reproduces fixtures F1–F4 inside a larger dataset (15 experts, 5 groups, about 25 parameters, 5 concepts) so you can see the hand-calculated values on screen. |
| D-63 | Response rate and attrition | Rate = respondents ÷ invited, per round. Attrition = 1 − (round-1 respondents who also answered round 2) ÷ round-1 respondents. Overall and per domain. |

---

## Answers received (19 Oct 2026)

You replied "OK (do what's best for the project and its results)". Applied as follows:

1. **C1:** separate identity key file, as written.
2. **P5:** **built**. It is a rule of the proposal (inclusion criteria per domain) and costs little: each domain has an inclusion-criteria text and an optional minimum years (surgery: 5); experts below it, or with «معیارهای ورود احراز شد» unticked, get a warning on the experts screen and in the panel check.
3. **D-36:** all-S concept in run 2 is not forwarded by itself (literal reading); overridable with a reason.
4. **D-38:** safety rule generalised to "fewer than two forwarded", as written.

## Additional decisions made during implementation

| ID | Point | Decision |
|---|---|---|
| D-64 | Excel library | SheetJS from npm (`xlsx@0.18.5`, pinned). The newer SheetJS builds are distributed only from the SheetJS CDN, which this build environment cannot reach. 0.18.5 has two published advisories that concern **parsing hostile files** (prototype pollution, ReDoS). The app only parses files you choose yourself (your parameter table and response sheets), so the practical risk is low; noted here for transparency. |
| D-65 | Which experts the panel description covers | The round-1 respondents (the panel that actually took part). Round-2 counts appear in the response-rate table. |
| D-66 | Thresholds validation | Settings warns only when "retain" and "remove" could truly hold at once: top ≥ retain-min and top ≤ remove-max, bottom ≥ remove-min and bottom ≤ retain-max, and the two minimums add up to ≤ 100 %. |
| D-67 | Sensitivity trigger with weights that do not sum to 1 | The trigger and the scenarios are evaluated on the normalised weights (D-46), so the gap is on the same 1–5 scale the proposal's 0.4 refers to. |
