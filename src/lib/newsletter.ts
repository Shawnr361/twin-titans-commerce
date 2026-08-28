import crypto from 'node:crypto';
import { prisma } from '@/lib/db';

/**
 * Marketing list. Stored in our own database — see the Subscriber model.
 *
 * The privacy policy makes three promises this file has to keep:
 *   1. consent is recorded, and kept only until it is withdrawn;
 *   2. every marketing email carries a working unsubscribe link;
 *   3. we can answer a deletion request.
 */

/** Normalise so "Me@Example.com " and "me@example.com" are one subscriber. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function newToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export interface SubscribeResult {
  /** True when this address was not already on the active list. */
  added: boolean;
  /** True when a previously unsubscribed address opted back in. */
  resubscribed: boolean;
  token: string;
}

/**
 * Add an address, or quietly re-confirm one already present.
 *
 * Never throws on a duplicate and never reveals whether an address was already
 * subscribed: the form is public, so a different response for "already on the
 * list" would turn it into an oracle for checking whether someone shops here.
 */
export async function subscribe(rawEmail: string, source = 'footer'): Promise<SubscribeResult> {
  const email = normaliseEmail(rawEmail);
  const existing = await prisma.subscriber.findUnique({ where: { email } });

  if (!existing) {
    const created = await prisma.subscriber.create({
      data: { email, source, token: newToken() },
    });
    return { added: true, resubscribed: false, token: created.token };
  }

  if (existing.unsubscribedAt) {
    /*
     * Opting back in is fresh consent, so consentAt moves and the old
     * withdrawal is cleared. The token is rotated too — the link in whatever
     * old email prompted them to leave should not keep working.
     */
    const updated = await prisma.subscriber.update({
      where: { email },
      data: { unsubscribedAt: null, consentAt: new Date(), source, token: newToken() },
    });
    return { added: false, resubscribed: true, token: updated.token };
  }

  return { added: false, resubscribed: false, token: existing.token };
}

/**
 * Withdraw consent.
 *
 * The row is kept rather than deleted, so that a later "why did you email me?"
 * can be answered with the date consent was given and the date it was
 * withdrawn. A full erasure request is a separate, manual act.
 */
export async function unsubscribeByToken(token: string): Promise<{ email: string } | null> {
  const found = await prisma.subscriber.findUnique({ where: { token } });
  if (!found) return null;

  if (!found.unsubscribedAt) {
    await prisma.subscriber.update({
      where: { token },
      data: { unsubscribedAt: new Date() },
    });
  }
  // Idempotent: clicking twice is a success, not an error.
  return { email: found.email };
}

/** Absolute URL for the unsubscribe link that every marketing email must carry. */
export function unsubscribeUrl(token: string, siteUrl: string): string {
  return `${siteUrl.replace(/\/$/, '')}/unsubscribe?token=${encodeURIComponent(token)}`;
}
