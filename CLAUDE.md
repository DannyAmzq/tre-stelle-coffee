# Tre Stelle Coffee Co. — Claude Handoff

## Project Overview
Next.js 16 (App Router, Turbopack) e-commerce + marketing site for Tre Stelle Coffee Co., a specialty coffee shop in Dallas, TX. Uses Sanity CMS for content, Stripe for checkout, Resend for transactional email, and hCaptcha for bot protection. Deployed on Vercel.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Sanity v5, Stripe v18, Resend, hCaptcha, lru-cache

---

## Active Branch
All current work is on: `claude/fix-security-issues-eDFXd`

PRs #9, #10, #11, #14, #15, #16, #17, #18 and #19 are merged. Restart the
branch from `main` before starting new work.

Note: a squash merge once silently dropped later commits from a PR (#14), so
after merging, verify the files actually landed on `main` before telling anyone
it shipped.

---

## Tracking Emails (how they actually work)

Status: **working** — verified end to end on 2026-09-10 (webhook 200, Resend
reported `Delivered`).

Two paths, so a single failure doesn't silently strand customers:

1. **Fast path** — `/api/send-tracking-email`. A Sanity webhook fires when an
   order changes; if it has a tracking number and hasn't been emailed, the email
   goes out immediately. Accepts **either** Sanity's native HMAC signature
   (`sanity-webhook-signature`, via `parseBody`) **or** a custom
   `Authorization: Bearer <secret>` header — both compared against
   `SANITY_WEBHOOK_SECRET`. Sanity webhooks can be configured either way, and
   only accepting one is how this broke.
   **A Secret MUST be set on the webhook in sanity.io/manage.** With the field
   empty, Sanity sends no auth at all and every delivery gets a 401.

### If tracking emails stop again, check this first

This exact failure burned ~6 months. Diagnose in this order:

1. **sanity.io/manage → API → Webhooks → Send Tracking Email → Attempts.**
   The HTTP code tells you almost everything: `401` = auth, `404` = wrong URL
   or the route isn't in the deployed build, `200` = it worked and the problem
   is downstream (check Resend).
2. **Is the webhook's Secret field populated?** It being empty was the root
   cause in Mar–Sep 2026. It is not obvious in the UI — you have to open
   "Edit webhook" and scroll to the bottom.
3. **Vercel → Logs.** Rejections log the specific reason (no signature at all
   vs. signature present but mismatched), not just "Unauthorized".
4. **Resend → Emails.** A `resendId` in the webhook's response body means we
   handed off successfully; delivery status lives in Resend.

`SANITY_WEBHOOK_SECRET` is shared by **both** Sanity webhooks (this one and
Next.js Redeploy). Rotating it means updating three places — the Vercel env var
plus both webhook Secret fields — or the one you miss starts 401ing.

2. **Safety net** — `/api/cron/send-pending-tracking-emails`, run daily at
   14:00 UTC (~9am Central) by Vercel Cron (see `vercel.json`). Sweeps up
   orders with a tracking number whose email never went out.
   **The schedule is daily because this project is on the Vercel Hobby plan,
   which caps cron jobs at once per day** — a more frequent schedule is
   rejected at deploy time. On Pro this can go back to hourly (`0 * * * *`).
   Because the sweep is only daily, the webhook above is still the path that
   matters for timely delivery. Guardrails: only looks back
   `TRACKING_EMAIL_LOOKBACK_DAYS` (default 14) so it can never blast a
   historical backlog, caps sends per run (`TRACKING_EMAIL_MAX_PER_RUN`,
   default 10), skips drafts/archived, and supports `?dryRun=1`.

Shared send logic lives in `src/lib/tracking-email.ts` — both paths call
`sendTrackingEmailForOrder(orderId)`, which re-reads the order immediately
before sending, so the two paths can't double-send.

Manual trigger / dry run:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://trestellecoffeeco.com/api/cron/send-pending-tracking-emails?dryRun=1"
```

---

## What Has Been Done

### Security fixes
- `src/app/api/admin/fix-order-reference/route.ts` — auth always enforced (was bypassable if env var unset)
- `src/app/api/send-tracking-email/route.ts` — webhook secret enforced (was commented out)
- `src/app/api/email-preview/tracking/route.ts` — XSS fix, HTML-escape all query params before interpolation
- `src/app/api/order-details/route.ts` — rejects unpaid Stripe sessions (was returning order data for any session ID)
- `src/app/api/checkout/route.ts` — origin allowlist (was open redirect), Stripe rate IDs moved to env vars
- `src/app/api/submit-review/route.ts` — input length limits, ReDoS-safe email validation (no regex), product existence check, hCaptcha timeout, no internal error leak
- `next.config.ts` — added `X-Content-Type-Options: nosniff` and `Permissions-Policy` headers

### SEO / metadata
- `src/lib/site.ts` — shared constants: SITE_URL, SITE_NAME, BUSINESS object
- `src/app/layout.tsx` — metadataBase, OG, Twitter cards, CafeOrCoffeeShop JSON-LD
- `src/app/products/[slug]/page.tsx` — generateMetadata with OG image, Product JSON-LD with offers + reviews
- Per-page layout.tsx metadata added for: about-us, events, press, find-us, wholesale, cart (noindex), checkout (noindex), privacy-policy, terms
- `src/app/sitemap.xml/route.ts` — dynamic sitemap fetching product slugs from Sanity
- `src/app/robots.ts` — disallows /api/, /studio/, /cart, /checkout

### Sanity client split
- `src/sanity/lib/client.ts` — `client` (write token, no CDN) for mutations; `readClient` (no token, CDN-enabled) for all public reads. Attaching a token bypasses Sanity CDN regardless of `useCdn`, hence the split.

### Cart UX
- `src/app/cart/page.tsx` — "Proceed to Checkout" button has spinner, aria-busy, helper text, and "🔒 Secure checkout powered by Stripe" trust line

### Event status
- The Immersive Coffee Experience class on **July 26, 2026** has passed. The
  date gate in `isImmersiveCoffeeEventEnabled` runs Jun 1 – Jul 26 2026, so the
  popup and homepage FeaturedEvent now hide themselves automatically. Nothing
  to turn off.
- The 4th anniversary popup + confetti (June 20) were removed entirely once the
  event passed.
- `src/lib/events.ts` holds the Eventbrite URL for the most recent listing.

---

## Re-enabling the Event (when rescheduled)
When Jonathan confirms a new date:
1. Update the date range in `components/ui/ImmersiveCoffeePopup.tsx` (`isImmersiveCoffeeEventEnabled`)
2. Re-add `<ImmersiveCoffeePopup />` to `src/app/InnerLayoutClient.tsx`
3. Update event date/time text in `components/ui/FeaturedEvent.tsx`
4. Update Eventbrite URL in `src/lib/events.ts` if a new listing is created
5. Optionally add an Upcoming Events card back to `src/app/events/page.tsx`

---

## Pending Security Items (not yet implemented)

1. **Timing-safe secret comparison** — done for `send-tracking-email` and the
   cron sweeper via `src/lib/secret-compare.ts` (`secretsMatch`, which also
   trims both sides so a pasted trailing newline can't cause a mystery 401).
   Still TODO: `src/app/api/admin/fix-order-reference/route.ts` uses a plain
   `!==` comparison and should use `secretsMatch` too.

2. **Stripe webhook idempotency** — prevent duplicate orders if Stripe retries a webhook. Check for existing order by `paymentIntentId` before creating.

3. **Rate limiting on checkout + order-details** — `/api/checkout` and `/api/order-details` have no rate limiting (submit-review does). Add LRUCache limiter same pattern as submit-review.

4. **Dependabot** — 67 npm vulnerabilities (3 critical, 29 high). Run `npm audit fix` or review Dependabot PRs.

---

## Week 2 QoL (not started)
- Trust signals: SSL badge, return policy blurb in footer
- Form autocomplete attributes on checkout/booking forms (`autocomplete="email"` etc.)
- Empty cart state: show product suggestions instead of blank cart
- "Notify Me" button for out-of-stock products (collect email, store in Sanity)

## Week 3+ (heavy lift)
- Compress/re-encode videos: currently ~60MB, target ~25MB (use ffmpeg or Cloudinary)
- Convert hero PNGs to WebP
- `loading.tsx` skeleton screens for product pages
- ISR revalidation on product detail pages (`revalidate = 3600`)

---

## Key File Map

| What | Where |
|------|-------|
| Sanity clients (read vs write) | `src/sanity/lib/client.ts` |
| Shared site constants | `src/lib/site.ts` |
| Eventbrite URL | `src/lib/events.ts` |
| Event popup (date gate + modal) | `components/ui/ImmersiveCoffeePopup.tsx` |
| Homepage featured event section | `components/ui/FeaturedEvent.tsx` |
| Global layout + JSON-LD | `src/app/layout.tsx` |
| Inner layout (navbar/footer/popups) | `src/app/InnerLayoutClient.tsx` |
| Checkout API | `src/app/api/checkout/route.ts` |
| Stripe webhook | `src/app/api/stripe-webhook/route.ts` |
| Review submission | `src/app/api/submit-review/route.ts` |
| Sitemap | `src/app/sitemap.xml/route.ts` |
| Robots | `src/app/robots.ts` |
| Tracking email send logic (shared) | `src/lib/tracking-email.ts` |
| Tracking email webhook (fast path) | `src/app/api/send-tracking-email/route.ts` |
| Tracking email sweeper (safety net) | `src/app/api/cron/send-pending-tracking-emails/route.ts` |
| Timing-safe secret comparison | `src/lib/secret-compare.ts` |
| Event booking inquiry API | `src/app/api/event-inquiry/route.ts` |
| Cron schedule | `vercel.json` |

---

## Rotating `SANITY_WEBHOOK_SECRET`

It is shared by two Sanity webhooks, and the change is not atomic, so there is
a short window where deliveries 401. Tracking emails sent in that window are
picked up by the daily sweeper; revalidation just misses a beat. Do it in this
order — it keeps the window to however long the dashboard clicks take, rather
than the length of a deploy:

1. Vercel → Settings → Environment Variables → set `SANITY_WEBHOOK_SECRET` to
   the new value.
2. Redeploy and wait for **Ready**.
3. sanity.io/manage → API → Webhooks → set the **Secret** field to the same
   value on **both** webhooks (Send Tracking Email *and* Next.js Redeploy).
4. Verify: re-save an order with a tracking number, confirm the webhook's
   Attempts shows **200**, and publish a content edit to confirm revalidation.

---

## Environment Variables Needed (Vercel)
- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`
- `SANITY_API_WRITE_TOKEN` (write token for mutations — note the `_WRITE_`; this
  is the name the code actually reads, via `src/sanity/env.ts`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PAID_SHIPPING_RATE_ID` (optional — falls back to hardcoded shr_ ID)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `HCAPTCHA_SECRET`
- `RESEND_API_KEY`
- `SANITY_WEBHOOK_SECRET` (must ALSO be set as the Secret on the Sanity webhook)
- `ADMIN_SECRET`
- `CRON_SECRET` (required for the tracking-email sweeper; Vercel Cron sends it
  automatically as `Authorization: Bearer <CRON_SECRET>`)
- `TRACKING_EMAIL_LOOKBACK_DAYS` (optional, default 14)
- `TRACKING_EMAIL_MAX_PER_RUN` (optional, default 10)

---

## Dev Commands
```bash
npm run dev       # start dev server (Turbopack)
npm run build     # production build (requires env vars)
npx tsc --noEmit  # type check only
```
