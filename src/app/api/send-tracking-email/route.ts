import { NextRequest, NextResponse } from 'next/server';
import { parseBody } from 'next-sanity/webhook';
import { sendTrackingEmailForOrder } from '@/lib/tracking-email';
import { secretsMatch } from '@/lib/secret-compare';

type OrderWebhookPayload = { _id?: string };

/**
 * Sanity webhook: fires when an order document changes. If a tracking number
 * has been added and the email hasn't gone out yet, sends it immediately.
 *
 * This is the fast path. If it fails for any reason, the daily sweeper at
 * /api/cron/send-pending-tracking-emails is the safety net.
 *
 * Two ways to authenticate, because Sanity webhooks can be configured either
 * way and getting the wrong one is how this endpoint silently broke before:
 *
 *  1. Sanity's native Secret — signs the payload and sends an HMAC in the
 *     `sanity-webhook-signature` header. Preferred.
 *  2. A custom `Authorization: Bearer <secret>` HTTP header set on the webhook.
 *
 * Both compare against SANITY_WEBHOOK_SECRET, so neither is a weaker path.
 * Whichever is configured, it works.
 */
export async function POST(req: NextRequest) {
	try {
		// Trimmed: Sanity computes the HMAC from the Secret exactly as stored in
		// its dashboard, so a stray newline on the Vercel copy breaks the match.
		const secret = process.env.SANITY_WEBHOOK_SECRET?.trim();
		if (!secret) {
			console.error('send-tracking-email: SANITY_WEBHOOK_SECRET is not configured');
			return NextResponse.json({ message: 'Webhook secret not configured' }, { status: 503 });
		}

		let payload: OrderWebhookPayload | null = null;

		const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
		const hasSignature = Boolean(req.headers.get('sanity-webhook-signature'));

		if (bearer && secretsMatch(bearer, secret)) {
			// Authenticated via custom Authorization header.
			payload = (await req.json().catch(() => null)) as OrderWebhookPayload | null;
		} else {
			// Fall back to Sanity's native signature. Note parseBody consumes the
			// request body, so this must be the only branch that reads it.
			const { body, isValidSignature } = await parseBody<OrderWebhookPayload>(req, secret);

			if (!isValidSignature) {
				// Say precisely what was wrong in the logs — a bare "Unauthorized"
				// is what made this take months to diagnose last time.
				console.warn(
					hasSignature
						? 'send-tracking-email: rejected — sanity-webhook-signature did not match SANITY_WEBHOOK_SECRET. The Secret on the Sanity webhook and the Vercel env var are different values.'
						: 'send-tracking-email: rejected — request carried neither a valid sanity-webhook-signature nor a matching Authorization header. Set a Secret on the webhook at sanity.io/manage (API → Webhooks) equal to SANITY_WEBHOOK_SECRET.'
				);
				return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
			}
			payload = body;
		}

		const orderId = payload?._id; // Sanity sends the document ID as _id

		if (!orderId) {
			console.error('send-tracking-email: missing order ID in payload');
			return NextResponse.json({ message: 'Missing order ID' }, { status: 400 });
		}

		const result = await sendTrackingEmailForOrder(orderId);

		if (result.status === 'failed') {
			return NextResponse.json(
				{ message: 'Failed to send tracking email', orderId },
				{ status: 500 }
			);
		}

		return NextResponse.json(result, { status: 200 });
	} catch (error: unknown) {
		console.error('send-tracking-email: error processing Sanity webhook:', error);
		return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
	}
}
