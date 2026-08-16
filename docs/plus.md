# KOBA Plus billing lifecycle

KOBA Plus is an optional premium membership. This phase builds subscription
infrastructure and entitlements. It does **not** invent a permanent benefit list.

Stripe **test mode only**. Live mode is not ready until the owner’s business
entity and supported country are verified.

## Ownership

Plus belongs to a **specific active KOBA account / KOBAID**, not to every role
under the same login.

A Player subscription does not grant Business or Influencer benefits. Checkout,
portal, cancel, reactivate, and entitlement checks all use
`resolveActivePlusIdentity`.

The earlier `PlusSubscription.userId` unique stub was a placeholder, not an
approved user-wide product rule. Phase 14F binds the row to `KobaIdentity`.

One Stripe Customer is reused per login (`User.stripeCustomerId`) so billing
identity stays stable; entitlements still stay per KOBAID.

## Plan configuration

Internal codes:

| Code                | Interval | Env Price ID                |
| ------------------- | -------- | --------------------------- |
| `KOBA_PLUS_MONTHLY` | Monthly  | `STRIPE_PRICE_PLUS_MONTHLY` |
| `KOBA_PLUS_ANNUAL`  | Annual   | `STRIPE_PRICE_PLUS_ANNUAL`  |

The server maps an approved plan code to the configured Stripe Price ID.
Browsers must not send Price IDs or amounts. Display amounts come from
`STRIPE_PLUS_*_AMOUNT_CENTS` and are not trusted for charging.

Plans are upserted by `ensurePlans()`. Missing Price IDs keep the plan inactive
(`stripePriceId = unconfigured`).

## Entitlement registry

| Code                        | Approved | Notes                                      |
| --------------------------- | -------- | ------------------------------------------ |
| `PLUS_BADGE`                | Yes      | Membership badge on approved surfaces      |
| `PROFILE_COSMETICS`         | No       | Placeholder                                |
| `AIDEN_PRIORITY`            | No       | Placeholder                                |
| `EXTRA_SERVER_SLOTS`        | No       | Placeholder                                |
| `ENHANCED_SHOP_THEME`       | No       | Placeholder                                |
| `HIGHER_UPLOAD_LIMITS`      | No       | Placeholder                                |
| `INCREASED_SAVED_ITEMS`     | No       | Placeholder                                |
| `LARGER_MEDIA_LIMITS`       | No       | Placeholder                                |
| `PROMOTIONAL_MONTHLY_COINS` | No       | Deferred until amount/bucket/expiry/refund |

Only approved codes may be enabled on a plan. Do not check `user.isPlus` in UI.
Use `hasEntitlement` / `hasEntitlementForIdentity`.

Promotional monthly Coins must not be granted until the owner approves amount,
purchased vs promotional classification, expiration, refund behaviour, and
renewal timing. If granted later, use the existing double-entry ledger with an
idempotent promotional grant.

Staff cannot mark a subscription Active. Compensatory access is a separate
`PlusEntitlementGrant` (reason, actor, optional expiry) via
`POST /api/admin/plus/grants`. That grant never writes Stripe state.

## Entitlement policy

| Internal state           | Entitled?                               |
| ------------------------ | --------------------------------------- |
| `ACTIVE`                 | Yes                                     |
| `ACTIVE` + cancel at end | Yes until verified `currentPeriodEnd`   |
| `TRIALING`               | Only if `KOBA_PLUS_TRIALS_ENABLED=true` |
| `PAST_DUE` / `UNPAID`    | No. No grace period is approved         |
| `INCOMPLETE` / `PAUSED`  | No                                      |
| `CANCELLED` / `EXPIRED`  | No                                      |

Trials default off. There is no payment-failure grace period.

## Subscription lifecycle

1. User selects an approved plan code.
2. Server creates a Stripe Checkout Session (platform Billing, not Connect).
3. User completes Stripe-hosted checkout.
4. Stripe sends a signed webhook.
5. KOBA verifies the signature.
6. The provider event ID is stored uniquely.
7. Local subscription state updates.
8. Entitlements become available.

The success URL (`/plus?checkout=processing`) only shows Processing. The browser
never marks Plus active.

## Webhooks and idempotency

Handled on the existing `POST /api/stripe/webhook` route:

- `checkout.session.completed` (Plus metadata `kobaPlus=1`)
- `checkout.session.expired`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Events are claimed in `ProcessedStripeEvent` (`eventId` unique). Duplicates
return success without re-applying. Out-of-order updates are ignored when
`event.created` is older than `lastStripeEventCreated`.

Never log card data, invoice PDFs, or webhook secrets.

## Cancellation and plan changes

Users cancel **at period end**. Entitlements remain until the verified period
end. Undo is supported while still entitled.

Immediate cancellation is not offered in-app (staff/refund policy later).

Plan switching (monthly ↔ annual) is **not implemented in-app**. Use the Stripe
Customer Portal. KOBA does not invent proration; whatever the Stripe Dashboard
proration setting is applies. Custom upgrade/downgrade math is deferred.

## Payment failure

Past-due / unpaid is shown honestly. The subscriber gets a safe “Manage billing”
action and an email that contains no card or invoice secrets. Entitlements are
revoked immediately (conservative policy, no grace).

## Reconciliation

`pnpm plus:reconcile` (or staff “Reconcile from Stripe”) fetches the Stripe
subscription and updates local state. Local unverified state is never written
back to Stripe. Prepare this as a VPS cron.

## Test-mode setup

1. Create monthly and annual Prices in the Stripe test Dashboard.
2. Set `STRIPE_PRICE_PLUS_MONTHLY` / `STRIPE_PRICE_PLUS_ANNUAL` in `.env.local`.
3. Keep `STRIPE_SECRET_KEY` as `sk_test_…`.
4. Forward webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
5. Subscribe from `/plus` and confirm the badge appears only after the webhook.

## Production-launch checklist (not ready)

- [ ] Owner business entity verified
- [ ] Supported Stripe country confirmed
- [ ] Live Price IDs created
- [ ] `STRIPE_ALLOW_LIVE` policy reviewed (currently blocked)
- [ ] Customer Portal proration setting documented
- [ ] Benefit list approved (beyond `PLUS_BADGE`)
- [ ] Coin grant policy approved if Coins will be included
- [ ] Legal / tax / consumer-cancellation copy

Do not claim Stripe live mode is ready.

## Stripe country / legal dependency

Checkout availability, tax, and consumer cancellation rules depend on the
platform’s Stripe country and legal entity. Those are not configured in this
phase. Test-mode cards work for development only.
