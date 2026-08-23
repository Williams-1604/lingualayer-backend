import sgMail from "@sendgrid/mail";
import { config } from "../config/env.js";
import type { Commission } from "./commission-indexer.js";

let configured = false;
function ensureConfigured(): boolean {
  if (!config.sendgridApiKey) return false;
  if (!configured) {
    sgMail.setApiKey(config.sendgridApiKey);
    configured = true;
  }
  return true;
}

export interface MailSender {
  send: (msg: { to: string; from: string; subject: string; text: string }) => Promise<unknown>;
}

const defaultSender: MailSender = { send: (msg) => sgMail.send(msg) };

/**
 * Notifies a commissioner that their commission was fulfilled.
 *
 * No-ops (with a log line, not an error) when SENDGRID_API_KEY isn't
 * configured, so local dev and tests don't need a real SendGrid account.
 */
export async function sendCommissionFulfilmentEmail(
  to: string,
  commission: Commission,
  sender: MailSender = defaultSender,
): Promise<boolean> {
  if (!ensureConfigured() && sender === defaultSender) {
    console.warn(
      `SENDGRID_API_KEY not set — skipping fulfilment email for commission ${commission.id}`,
    );
    return false;
  }

  await sender.send({
    to,
    from: config.sendgridFromEmail,
    subject: `Your commission "${commission.id}" has been fulfilled`,
    text: `Good news! Your ${commission.languageCode} commission (bounty ${commission.bountyAmountUsdc} USDC) has been fulfilled.`,
  });
  return true;
}
