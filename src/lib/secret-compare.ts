import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time comparison of two shared secrets.
 *
 * Both sides are trimmed first: secrets are copy-pasted into dashboards
 * (Vercel, Sanity) and a stray trailing newline or space is a very easy way to
 * get a mystifying 401. Hashing first keeps the comparison fixed-length, which
 * is what `timingSafeEqual` requires and also avoids leaking length.
 */
export function secretsMatch(
	provided: string | null | undefined,
	expected: string | null | undefined
): boolean {
	if (!provided || !expected) return false;

	const a = createHash('sha256').update(provided.trim()).digest();
	const b = createHash('sha256').update(expected.trim()).digest();
	return timingSafeEqual(a, b);
}
