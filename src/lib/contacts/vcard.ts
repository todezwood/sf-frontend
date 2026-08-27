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

/** RFC 2426 §2.6: physical lines should not exceed 75 octets, excluding CRLF. */
const MAX_LINE_OCTETS = 75;

const utf8 = new TextEncoder();
const utf8Decoder = new TextDecoder();

/**
 * Fold one logical line into 75-octet physical lines, each continuation
 * starting with a space. Splits are measured in UTF-8 octets and backed off
 * so a multi-byte character is never cut in half.
 */
export function foldVCardLine(line: string): string[] {
  const octets = utf8.encode(line);
  if (octets.length <= MAX_LINE_OCTETS) return [line];

  const folded: string[] = [];
  let start = 0;
  while (start < octets.length) {
    // Continuation lines spend one of their 75 octets on the leading space.
    const room = start === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    let end = Math.min(start + room, octets.length);
    while (end < octets.length && (octets[end] & 0b1100_0000) === 0b1000_0000) {
      end -= 1;
    }
    const chunk = utf8Decoder.decode(octets.subarray(start, end));
    folded.push(start === 0 ? chunk : ` ${chunk}`);
    start = end;
  }
  return folded;
}

export interface VCardOptions {
  /**
   * Embed the photo. Off by default: a QR code tops out around 3 KB, so the
   * scannable card must stay lean, while the downloaded .vcf can afford it.
   */
  includePhoto?: boolean;
  /** Include the postal addresses. On by default. */
  includeAddresses?: boolean;
  /** Include the free-text notes — the largest field after the photo. */
  includeNotes?: boolean;
}

export function contactToVCard(
  contact: Contact,
  {
    includePhoto = false,
    includeAddresses = true,
    includeNotes = true,
  }: VCardOptions = {},
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

  if (includeAddresses) {
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
  }

  if (includeNotes && contact.notes) lines.push(`NOTE:${esc(contact.notes)}`);

  if (includePhoto && contact.photo) {
    const match = /^data:image\/(\w+);base64,(.+)$/.exec(contact.photo);
    if (match) {
      lines.push(`PHOTO;ENCODING=b;TYPE=${match[1].toUpperCase()}:${match[2]}`);
    }
  }

  lines.push("END:VCARD");
  // Fold long lines (the photo especially) and end with CRLF, per the RFC.
  return `${lines.flatMap(foldVCardLine).join("\r\n")}\r\n`;
}
