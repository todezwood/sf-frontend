import type { Contact } from "./types";

/**
 * Minimal vCard 3.0 serializer. Version 3.0 rather than 4.0 because it is
 * what iOS and Android camera apps import most reliably from QR codes.
 */

/** Escape a text value per RFC 2426: backslash, separators, newlines. */
export function escapeVCardText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export interface VCardOptions {
  /**
   * Embed the photo. Off by default: a QR code tops out around 3 KB, so the
   * scannable card must stay lean, while the downloaded .vcf can afford it.
   */
  includePhoto?: boolean;
}

export function contactToVCard(
  contact: Contact,
  { includePhoto = false }: VCardOptions = {},
): string {
  const esc = escapeVCardText;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(contact.last_name)};${esc(contact.first_name)};;;`,
    `FN:${esc(contact.full_name)}`,
    `EMAIL;TYPE=INTERNET:${esc(contact.email)}`,
  ];

  if (contact.phone) lines.push(`TEL;TYPE=CELL:${esc(contact.phone)}`);
  if (contact.company) lines.push(`ORG:${esc(contact.company)}`);
  if (contact.job_title) lines.push(`TITLE:${esc(contact.job_title)}`);

  for (const address of contact.addresses) {
    const parts = [
      address.street,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ].map((part) => esc(part ?? ""));
    // ADR is: PO box; extended; street; locality; region; postal code; country
    lines.push(`ADR;TYPE=${address.type.toUpperCase()}:;;${parts.join(";")}`);
  }

  if (contact.notes) lines.push(`NOTE:${esc(contact.notes)}`);

  if (includePhoto && contact.photo) {
    const match = /^data:image\/(\w+);base64,(.+)$/.exec(contact.photo);
    if (match) {
      lines.push(`PHOTO;ENCODING=b;TYPE=${match[1].toUpperCase()}:${match[2]}`);
    }
  }

  lines.push("END:VCARD");
  return lines.join("\r\n");
}
