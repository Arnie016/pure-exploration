# Personal collection and resource links

## Intended experience

Visitors keep a small collection of mementos as they explore, save moments and leave ideas. The interface lives behind a quiet achievement control; it does not introduce a landing page, currency, daily streak or competitive score.

- Promise: acknowledge actual exploration without interrupting it.
- Audience and task: visitors who want to keep or share a memory of a world.
- Platform: desktop and narrow-screen web, keyboard and touch.
- Direction: a dark field notebook with restrained warm emblems.
- Taste: preserve the immersive world, keep attribution, avoid extra social links and promotional panels.

## Six achievements

| Memento | Evidence required |
| --- | --- |
| A door left open | One eligible world visited |
| Curious hands | A control tried in three distinct eligible worlds |
| Every open door | All currently eligible worlds visited |
| A moment, kept | A screenshot or recording successfully saved |
| Something worth noting | A note successfully saved |
| A little better | Feedback successfully submitted |

Eligible worlds are read from the live project catalog: a URL, featured not false, and a category other than Tools. The lobby does not count. Duplicate events do not increase totals. If new worlds join the collection, the existing all-world memento remains with its original collection size while the visitor sees additional doors remaining.

These are browser-local, self-reported mementos. They are **not** authenticated game accomplishments, anti-cheat proofs, transferable entitlements, cash rewards, vouchers or credits. Local storage can be changed by its owner. This is sufficient for a personal souvenir; it must not be reused for financial reward eligibility.

The component listens for `pe-progress` only after the host confirms the corresponding action. It can hydrate previous visits from `pe-journey-sync`; it does not infer captures, notes or interactions from a page visit. Privacy reset can dispatch `pe-forget-progress`. Saved PNGs contain only the badge text, public site and public maker attribution.

## Resource link verification, 2026-09-30 (Singapore)

Source of exact URLs: `/Users/arnav/.codex/skills/referral-link-bank/references/links.yaml`, reread in this run.

| Resource | Source evidence | Current verification | Treatment |
| --- | --- | --- | --- |
| Arnav's Codex course | Exact URL and referral code stored as user-provided on 2026-06-05 | Udemy blocks automated retrieval with HTTP 403. Search did not resolve this exact course. Current price, discount, course availability and checkout terms remain unverified. | Optional referral link inside expanded resources after Curious hands. No discount amount, free access or availability claim. Explicit referral disclosure and instruction to check current price/availability. |
| Pure Exploration public source | Existing project source link | Already supplied by the authoritative current app | Free public-source link; no exclusivity or paid-access claim. |
| Repurpose.io | Exact referral link in the same bank | Automated primary-page retrieval unavailable | Omitted: not needed in the exploration flow. |
| GPT Tools | Exact referral link in the same bank | Not reviewed in this bounded run | Omitted: not needed in the exploration flow. |
| Credits, vouchers, priority contact, private email, exclusive workflows | No verified reward inventory or issuance terms found in the bounded source | Unverified | Not promised or exposed. |

Preserved Udemy URL:
`https://www.udemy.com/course/openai-codex-ai-agent-workflows/?referralCode=9394549FD2DB6B765A06`

A referral link is not proof of a discount. Redeemable rewards need a separate server-authoritative eligibility and issuance system, explicit terms, a real inventory and abuse controls before they can be offered.

## Validation

- Six model tests pass: distinct-event deduplication, eligible-catalog completeness, unrelated milestone isolation, bounded malformed storage, empty catalog and attributed share copy.
- TypeScript check passes for these files and the current shared tree at completion.
- The PNG is drawn locally with original text and primitive geometry; it fetches no third-party image or font.
- Memento notice respects reduced motion and disappears after 4.5 seconds. Collection supports Escape, initial focus, focus trap, and return focus.
- Browser visual verification: pending integration by the main task.
- Human comprehension and device listening review: NOT_TESTED.
