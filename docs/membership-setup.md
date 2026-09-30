# Pure Exploration membership setup — 30 September 2026

Status: PREPARED, ENROLLMENT CLOSED. Current games remain free.

## Reviewed before launch

The app currently has a preview-only membership component, anonymous HttpOnly visitor sessions, D1 activity storage and no paid entitlements or member account recovery. Stripe Dashboard is authenticated; the connector still requires reconnection, and the saved server key returns HTTP 401. Browser checkout inherits the account’s BitePDF merchant branding. Do not rename account-wide branding without considering the other products on this same account.

The user approved monthly USD prices $1.99 / $4.99 / $8.99, with benefits added to free games. A Udemy referral link is a separate course purchase, not free enrollment. All coupon rows supplied on 30 September were expired; no active coupon was shown. Collaboration email and response terms remain unspecified. No Codex provider credits, account sharing, guaranteed replies, course enrollment or office-hour schedule may be advertised as available until confirmed.

## Created in the authorized Stripe account

| Tier | Monthly USD | Product | Price | Payment link | State |
| --- | --- | --- | --- | --- | --- |
| Supporter | 1.99 | prod_VLqv999y0QAk2n | price_1UL9DhG4JaXi6Dm2yZRgZreR | https://buy.stripe.com/14A5kD3MG7yCcHXeAC8EM05 | Deactivated |
| Workshop | 4.99 | prod_VLqw3iDiYkf9AK | price_1UL9EdG4JaXi6Dm2QlWikZTc | https://buy.stripe.com/aFa4gzfvo4mqdM10JM8EM06 | Deactivated |
| Collaborator | 8.99 | prod_VLqxh6G5Legsay | price_1UL9FjG4JaXi6Dm2oyLpkklR | https://buy.stripe.com/3cIfZh970bOS6jzgIK8EM07 | Deactivated |

Link IDs: plink_1UL9HKG4JaXi6Dm2T0cSTk0Q, plink_1UL9ekG4JaXi6Dm2EMOfw6QU, plink_1UL9hHG4JaXi6Dm2ISiFBimn.

Quantity fixed at 1; no trial; automatic tax turned off because registration was not verified; managed payments add-on not enabled. Return URL is https://pure-exploration.arnz.chatgpt.site/?membership=return. This URL must never grant access. The links were created and immediately deactivated, and each deactivated state was verified in Dashboard. No payment was made. Do not distribute as available checkout links.

## Fulfillment design required before activation

1. Keep billing credentials in Worker environment secrets. Obtain a working restricted key through the native secret route, never chat or client code. Use a separate Stripe sandbox to validate the integration. The authenticated MCP planner could not run while the connector requires reauthentication.
2. Connect checkout to an authenticated, recoverable member identity. An anonymous visitor cookie or knowledge of an email address is insufficient for cross-device paid access. Payment Links can carry a non-sensitive client reference identifying a server-side checkout record; the reference itself cannot authorize access.
3. Verify webhook signatures against the raw body, enforce timestamp freshness, deduplicate event IDs, and resolve current subscription state using Stripe. Grant only the allowlisted tier after verified payment; handle checkout completion and asynchronous payment success. Process renewal, payment failure, cancellation, refunds and tier changes. Return pages and localStorage are never entitlement authorities.
4. Serve paid packs from authenticated server endpoints; exclude paid content from public assets and JavaScript bundles. Include version, exact deliverables, attribution and download terms. Keep the existing free prompt pack free.
5. Provide a customer portal for billing management and cancellation. Confirm duplicate-subscription protection, support/refund contact and whether cancellation retains access until the paid period ends. No automatic tax activation without verified registrations.
6. Confirm deliverables: Supporter build-note delivery and profile recognition; Workshop versioned workflow packs plus a genuine current Udemy enrollment offer if promised; Collaborator contact channel and realistic response terms. Expiring coupon availability must be checked before presenting enrollment as included.
7. Exercise sandbox payment success, delayed payment, declined/pending checkout, webhook replay, renewal failure, cancellation, upgrade/downgrade, account recovery and cross-member isolation. Only after server and hosted tests pass should all three links be activated and added to public checkout buttons.

## Local interface change

A compact Support entry appears in the shared top-right world controls, opening the existing tier preview. It follows the existing HUD fade and keyboard focus behavior. Enrollment remains explicitly closed; current games are unaffected. Human review: NOT_TESTED. Local typecheck passed; browser review is recorded in the task proof folder. Public activation/deployment is not claimed.

## Primary references

- https://docs.stripe.com/payment-links
- https://docs.stripe.com/payments/checkout/limit-subscriptions
- https://docs.stripe.com/billing/entitlements

## Connector checkpoint · 1 October 2026

The reconnected Stripe connector exposes a live DoodilyDo account with context acct_1TfHlE58O2I89qdS. This differs from the historical G4JaXi6Dm2 product/price IDs above; those IDs must be verified in their original account before reuse. No duplicate products or new live links created. The user requested future locked member worlds, ongoing course materials and prompts. Existing worlds stay free. Member content, enrollment identity, verified lifecycle webhooks and billing management remain required before sales open. Current Udemy referral still does not grant enrollment. Proposed paid-world catalogue must consist of real available worlds, not fabricated locked cards.

Lobby expansion brief: House of Poe cinema accepts creator-submitted AI videos into a pending moderation queue; analysis covers frames/OCR/audio with human review and appeals before public playback. No automatic approval is implied. Future lobby mechanics: jump, first-person camera, equipment/footprint cosmetics and a five-slot emote wheel. Upload, moderation-provider cost and public distribution are not enabled by this checkpoint.
