import { Resend } from 'resend';
import { createClient } from '@sanity/client';
import type Stripe from 'stripe';

const resend = new Resend(process.env.RESEND_API_KEY);

export const orderClient = createClient({
	projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
	dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
	apiVersion: '2024-05-01',
	token: process.env.SANITY_API_WRITE_TOKEN!, // Needs write access
	useCdn: false,
});

interface ProductDetailItem {
	name: string;
	quantity: number;
}

export interface SanityOrderDocument {
	_id: string;
	_type: 'order';
	customerEmail?: string;
	trackingNumber?: string;
	trackingEmailSent?: boolean;
	stripeSessionId?: string;
	orderItems?: Array<{
		productId: string;
		productName: string;
		quantity: number;
		size?: string;
	}>;
	productDetails?: string; // Legacy field
}

export type SendTrackingEmailResult =
	| { status: 'sent'; orderId: string; resendId?: string }
	| { status: 'skipped'; orderId: string; reason: string }
	| { status: 'failed'; orderId: string; reason: string };

/** Human-readable summary of the items in an order, for the email body. */
function formatProductsText(order: SanityOrderDocument): string {
	const { orderItems, productDetails } = order;

	if (orderItems && orderItems.length > 0) {
		return orderItems
			.map((item) => {
				const sizeText = item.size ? ` (${item.size})` : '';
				return `${item.productName}${sizeText} (Qty: ${item.quantity})`;
			})
			.join(', ');
	}

	if (typeof productDetails === 'string') {
		// Fallback to legacy field if orderItems is not available
		try {
			const productsArray = JSON.parse(productDetails) as ProductDetailItem[];
			return productsArray.map((p) => `${p.name} (Qty: ${p.quantity})`).join(', ');
		} catch (e) {
			console.warn('Could not parse productDetails for email:', e);
			return productDetails;
		}
	}

	return 'Your items';
}

/** Look up the customer's first name from Stripe so the greeting is personal. */
async function resolveFirstName(order: SanityOrderDocument): Promise<string> {
	try {
		if (order.stripeSessionId && process.env.STRIPE_SECRET_KEY) {
			const stripeMod = await import('stripe');
			const stripeClient = new stripeMod.default(process.env.STRIPE_SECRET_KEY as string, {
				apiVersion: '2025-04-30.basil',
			});
			const session = (await stripeClient.checkout.sessions.retrieve(
				order.stripeSessionId
			)) as Stripe.Checkout.Session;
			const fullName = session?.customer_details?.name || '';
			if (fullName) {
				const parts = String(fullName).trim().split(/\s+/);
				if (parts[0]) return parts[0];
			}
		}
	} catch (e) {
		console.warn('Could not retrieve first name from Stripe:', e);
	}
	return 'there';
}

export function buildTrackingEmailHtml({
	firstName,
	productsText,
	trackingNumber,
}: {
	firstName: string;
	productsText: string;
	trackingNumber: string;
}): string {
	const uspsTrackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;

	return `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Shipped</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
                line-height: 1.6;
                color: #2E1A13;
                background-color: #f4f4f4;
              }
              a.button {
                display: inline-block;
                padding: 12px 25px;
                background-color: #4a0000;
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 5px;
                font-size: 16px;
                font-weight: 600;
              }
            </style>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; line-height: 1.6; color: #333333; background-color: #f4f4f4;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4;">
              <tr>
                <td align="center" style="padding: 20px 0;">
                  <table width="600" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
                    <tr>
                      <td align="center" style="padding: 18px 20px; background-color: #4a0000; color: #ffffff;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; margin: 0 auto;">
							<tr>
								<td width="160" align="left" style="vertical-align: middle;">
									<img src="https://trestellecoffeeco.com/images/white-logo.png" alt="Tre Stelle Coffee" width="140" style="display: block; max-width: 140px; height: auto;" />
								</td>
								<td align="center" style="vertical-align: middle; color:#e7c583; font-weight: 700; font-size: 18px;">Order Update</td>
								<td width="160" align="right" style="vertical-align: middle;"></td>
							</tr>
						</table>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 10px 20px; background-color: #e7c583; color: #4a0000; font-weight: 600; font-size: 14px;">Your Order Has Shipped</td>
                    </tr>
                    <tr>
                      <td style="padding: 30px 25px;">
                        <p style="margin: 0 0 15px; font-size: 16px;">Hi ${firstName},</p>
                        <p style="margin: 0 0 15px; font-size: 16px;">Great news! Your Tre Stelle Coffee order containing <strong>${productsText}</strong> has shipped via USPS.</p>
                        <p style="margin: 0 0 10px; font-size: 16px;">You can track your package using the following USPS tracking number:</p>
                        <p style="margin: 20px 0; text-align: center;">
                          <a class="button" href="${uspsTrackingUrl}" target="_blank">
                            <strong>${trackingNumber}</strong>
                          </a>
                        </p>
                        <p style="margin: 0 0 15px; font-size: 16px;">Please allow some time for the tracking information to update.</p>
                        <p style="margin: 0 0 15px; font-size: 14px; color: #555555;">If the link above doesn't work, you can also go to <a href="https://www.usps.com/manage/welcome.htm" target="_blank" style="color: #4a0000; text-decoration: underline;">USPS.com</a> and enter the tracking number manually.</p>
                        <p style="margin: 25px 0 0; font-size: 16px;">Thanks for your order!</p>
                        <p style="margin: 5px 0 0; font-size: 16px;">The Tre Stelle Coffee Team</p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td align="center" style="padding: 20px; background-color: #f6efe2; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                        <p style="margin: 0 0 6px; font-size: 12px; color: #2E1A13;">&copy; ${new Date().getFullYear()} Tre Stelle Coffee. All rights reserved.</p>
                        <p style="margin: 0; font-size: 12px; color: #6b5a54;">If the tracking button doesn't work, your tracking number is <strong>${trackingNumber}</strong>.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
          `;
}

/**
 * Sends the "your order has shipped" email for a single order and marks it as
 * sent in Sanity.
 *
 * Always re-reads the order immediately before sending, so it is safe to call
 * from both the Sanity webhook and the cron sweeper without double-sending:
 * whichever runs second sees `trackingEmailSent === true` and skips.
 */
export async function sendTrackingEmailForOrder(
	orderId: string
): Promise<SendTrackingEmailResult> {
	const order = (await orderClient.getDocument(orderId)) as SanityOrderDocument | null;

	if (!order) {
		return { status: 'skipped', orderId, reason: 'Order not found' };
	}

	const { customerEmail, trackingNumber, trackingEmailSent } = order;

	if (!trackingNumber) {
		return { status: 'skipped', orderId, reason: 'No tracking number' };
	}
	if (trackingEmailSent) {
		return { status: 'skipped', orderId, reason: 'Email already sent' };
	}
	if (!customerEmail) {
		console.error(`Order ${orderId} has tracking number but no customer email.`);
		return { status: 'skipped', orderId, reason: 'Customer email missing' };
	}

	const productsText = formatProductsText(order);
	const firstName = await resolveFirstName(order);

	try {
		const { data, error } = await resend.emails.send({
			from: 'Tre Stelle Coffee <contact@trestellecoffeeco.com>', // Must match the verified Resend domain
			to: [customerEmail],
			subject: 'Your Tre Stelle Coffee Order Has Shipped!',
			html: buildTrackingEmailHtml({ firstName, productsText, trackingNumber }),
		});

		if (error) {
			console.error(`Resend API Error for order ${orderId}:`, error);
			return { status: 'failed', orderId, reason: error.message };
		}

		console.log(`Tracking email sent for order ${orderId}, Resend ID: ${data?.id}`);

		// Mark as sent so neither the webhook nor the sweeper sends it again.
		await orderClient.patch(orderId).set({ trackingEmailSent: true }).commit();
		console.log(`Order ${orderId} updated in Sanity: trackingEmailSent set to true.`);

		return { status: 'sent', orderId, resendId: data?.id };
	} catch (emailError: unknown) {
		const reason =
			emailError instanceof Error
				? emailError.message
				: 'An unknown error occurred in email sending process';
		console.error(`Failed to send email or update Sanity for order ${orderId}:`, emailError);
		return { status: 'failed', orderId, reason };
	}
}
