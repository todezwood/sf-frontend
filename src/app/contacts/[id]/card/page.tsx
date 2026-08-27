import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ChevronLeft, Download } from "lucide-react";
import ContactCard from "@/components/contacts/ContactCard";
import { buttonClasses } from "@/components/ui/Button";
import { getContact } from "@/lib/contacts/api";
import { contactStats } from "@/lib/contacts/stats";
import { contactToVCard, type VCardOptions } from "@/lib/contacts/vcard";
import type { Contact } from "@/lib/contacts/types";

type PageProps = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 1) notFound();
  return id;
}

/**
 * A QR code at the default error-correction level holds ~2.3 KB, while notes
 * and addresses are large enough that a valid contact can exceed it. Try the
 * richest payload first and shed the bulkiest sections until one fits.
 * There is no guaranteed-to-fit payload: the schema caps count characters
 * while QR capacity counts UTF-8 octets, so identity fields full of
 * multi-byte text can outgrow even the roomiest symbol. When that happens
 * the card renders without a QR and points at the vCard download instead.
 */
const QR_PAYLOADS: VCardOptions[] = [
  {},
  { includeNotes: false },
  { includeNotes: false, includeAddresses: false },
];

async function contactQrCode(contact: Contact): Promise<string | null> {
  for (const [index, options] of QR_PAYLOADS.entries()) {
    const lastResort = index === QR_PAYLOADS.length - 1;
    try {
      return await QRCode.toDataURL(contactToVCard(contact, options), {
        margin: 1,
        width: 240,
        // The roomiest correction level buys the last attempt ~600 more bytes.
        errorCorrectionLevel: lastResort ? "L" : "M",
      });
    } catch {
      // Payload too large for the QR symbol — retry with a slimmer vCard.
    }
  }
  return null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const contact = await getContact(parseId((await params).id));
  return {
    title: contact ? `${contact.full_name} — card` : "Contact not found",
  };
}

export default async function ContactCardPage({ params }: PageProps) {
  const contact = await getContact(parseId((await params).id));
  if (!contact) notFound();

  // The QR carries the vCard itself (minus the photo — QR capacity is ~3 KB),
  // so a scan works offline and never depends on this server being reachable.
  const qrDataUrl = await contactQrCode(contact);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link
        href={`/contacts/${contact.id}`}
        className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        {contact.full_name}
      </Link>

      <div className="flex flex-col items-center gap-6">
        <ContactCard
          contact={contact}
          stats={contactStats(contact)}
          qrDataUrl={qrDataUrl}
        />

        <a
          href={`/contacts/${contact.id}/card/vcard/`}
          className={buttonClasses("secondary")}
        >
          <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Download vCard
        </a>

        <p className="max-w-md text-center text-[13px] text-muted-foreground">
          Stats grow as the record does — add a photo, addresses, and notes to
          level {contact.first_name} up.
        </p>
      </div>
    </div>
  );
}
