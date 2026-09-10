import { NextRequest, NextResponse } from 'next/server';
import { orderClient, sendTrackingEmailForOrder } from '@/lib/tracking-email';
import type { SendTrackingEmailResult } from '@/lib/tracking-email';
import { secretsMatch } from '@/lib/secret-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Safety net for tracking emails.
 *
 * The Sanity webhook (/api/send-tracking-email) is the fast path, but it can
 * silently stop working (bad/missing secret, disabled webhook, outage) and
 * nobody notices for weeks. This job sweeps up any order that has a tracking
 * number but never got its email, so a broken webhook degrades from "customers
 * never hear anything" to "the email is up to an hour late".
 *
 * Deliberate guardrails:
 *  - Only looks back TRACKING_EMAIL_LOOKBACK_DAYS (default 14). Without this,
 *    the first run would email every historical order whose email was missed,
 *    months after the fact.
 *  - Caps how many are sent per run, so one run can't fan out unexpectedly.
 *  - Skips drafts and archived orders.
 *  - `?dryRun=1` reports what *would* be sent without sending anything.
 */

const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_MAX_PER_RUN = 10;

function isAuthorized(req: NextRequest): boolean {
	const provided = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
	return secretsMatch(provided, process.env.CRON_SECRET);
}

function positiveIntFromEnv(name: string, fallback: number): number {
	const parsed = Number(process.env[name]);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const PENDING_ORDERS_QUERY = `*[
	_type == "order"
	&& !(_id in path("drafts.**"))
	&& defined(trackingNumber) && trackingNumber != ""
	&& trackingEmailSent != true
	&& defined(customerEmail) && customerEmail != ""
	&& isArchived != true
	&& dateTime(coalesce(orderTimestamp, _createdAt)) > dateTime($cutoff)
] | order(_createdAt asc) {
	_id,
	customerEmail,
	trackingNumber
}`;

type PendingOrder = { _id: string; customerEmail: string; trackingNumber: string };

export async function GET(req: NextRequest) {
	if (!process.env.CRON_SECRET) {
		console.error('send-pending-tracking-emails: CRON_SECRET is not configured');
		return NextResponse.json({ message: 'Cron secret not configured' }, { status: 503 });
	}
	if (!isAuthorized(req)) {
		console.warn('send-pending-tracking-emails: unauthorized attempt');
		return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
	}

	const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
	const lookbackDays = positiveIntFromEnv('TRACKING_EMAIL_LOOKBACK_DAYS', DEFAULT_LOOKBACK_DAYS);
	const maxPerRun = positiveIntFromEnv('TRACKING_EMAIL_MAX_PER_RUN', DEFAULT_MAX_PER_RUN);
	const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

	try {
		const pending: PendingOrder[] = await orderClient.fetch<PendingOrder[]>(
			PENDING_ORDERS_QUERY,
			{ cutoff }
		);
		const batch: PendingOrder[] = pending.slice(0, maxPerRun);

		if (dryRun) {
			return NextResponse.json({
				dryRun: true,
				lookbackDays,
				maxPerRun,
				pendingCount: pending.length,
				wouldSend: batch.map((o) => ({
					orderId: o._id,
					customerEmail: o.customerEmail,
					trackingNumber: o.trackingNumber,
				})),
			});
		}

		const results: SendTrackingEmailResult[] = [];
		for (const order of batch) {
			// Sequential on purpose: keeps us within the function time budget and
			// avoids hammering Resend/Stripe with a burst.
			results.push(await sendTrackingEmailForOrder(order._id));
		}

		const sent = results.filter((r) => r.status === 'sent').length;
		const skipped = results.filter((r) => r.status === 'skipped').length;
		const failed = results.filter((r) => r.status === 'failed');

		if (sent > 0) {
			console.log(`Tracking email sweeper: sent ${sent} email(s) the webhook had missed.`);
		}
		if (failed.length > 0) {
			console.error('Tracking email sweeper: failures', failed);
		}

		return NextResponse.json({
			lookbackDays,
			pendingCount: pending.length,
			processed: batch.length,
			sent,
			skipped,
			failed: failed.length,
			remaining: Math.max(pending.length - batch.length, 0),
			results,
		});
	} catch (error: unknown) {
		console.error('send-pending-tracking-emails: unexpected error', error);
		return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
	}
}
