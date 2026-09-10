import { NextRequest, NextResponse } from 'next/server';
import { parseBody } from 'next-sanity/webhook';
import { sendTrackingEmailForOrder } from '@/lib/tracking-email';

/**
 * Sanity webhook: fires when an order document changes. If a tracking number
 * has been added and the email hasn't gone out yet, sends it immediately.
 *
 * This is the fast path. If it fails for any reason (bad signature, outage,
 * webhook disabled), the cron sweeper at
 * /api/cron/send-pending-tracking-emails is the safety net.
 */
export async function POST(req: NextRequest) {
	try {
		// Verify the request is a genuine Sanity webhook using its native HMAC
		// signature (the `sanity-webhook-signature` header). Sanity does NOT send
		// an Authorization header, so a Bearer-token check would reject every
		// legitimate webhook. This mirrors /api/revalidate-sanity.
		if (!process.env.SANITY_WEBHOOK_SECRET) {
			console.error('SANITY_WEBHOOK_SECRET is not configured');
			return NextResponse.json({ message: 'Webhook secret not configured' }, { status: 503 });
		}

		const { body: payload, isValidSignature } = await parseBody<{ _id?: string }>(
			req,
			process.env.SANITY_WEBHOOK_SECRET
		);

		if (!isValidSignature) {
			console.warn('send-tracking-email: invalid Sanity webhook signature');
			return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
		}

		const orderId = payload?._id; // Sanity sends the document ID as _id

		if (!orderId) {
			console.error('Sanity Webhook: Missing order ID in payload');
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
		console.error('Error processing Sanity webhook:', error);
		return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
	}
}
