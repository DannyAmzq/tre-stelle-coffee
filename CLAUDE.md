# Tre Stelle Coffee Co. — Claude Handoff

## Project Overview
Next.js 16 (App Router, Turbopack) e-commerce + marketing site for Tre Stelle Coffee Co., a specialty coffee shop in Dallas, TX. Uses Sanity CMS for content, Stripe for checkout, Resend for transactional email, and hCaptcha for bot protection. Deployed on Vercel.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Sanity v5, Stripe v18, Resend, hCaptcha, lru-cache

---

## Active Branch
All current work is on: `claude/fix-security-issues-eDFXd`

PRs #9, #10, #11, #14, #15 and #16 are merged. Restart the branch from `main`
before starting new work.

---

## Tracking Emails (how they actually work)

Two paths, so a single failure doesn't silently strand customers:

1. **Fast path** — `/api/send-tracking-email`. A Sanity webhook fires when an
   order changes; if it has a tracking number and hasn't been emailed, the email
   goes out immediately. Authenticated with Sanity's **native HMAC signature**
   (`parseBody`/`isValidSignature`), NOT a Bearer token — Sanity never sends an
   `Authorization` header, so a Bearer check rejects every real webhook.
   **This requires a Secret set on the webhook in sanity.io/manage that matches
   `SANITY_WEBHOOK_SECRET` in Vercel.** Without it every delivery gets a 401.

2. **Safety net** — `/api/cron/send-pending-tracking-emails`, run hourly by
   Vercel Cron (see `vercel.json`). Sweeps up orders with a tracking number
   whose email never went out. Guardrails: only looks back
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
- Event postponed — popup and homepage FeaturedEvent are disabled (date gate set to 2099)
- `src/lib/events.ts` — Eventbrite URL updated to new listing (ready for when event is rescheduled)

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

1. **Timing-safe secret comparison** — use `crypto.timingSafeEqual` for webhook/admin token checks in:
   - `src/app/api/send-tracking-email/route.ts`
   - `src/app/api/admin/fix-order-reference/route.ts`

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
