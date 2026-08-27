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
 * The QR has two ceilings, and the card sheds vCard sections (notes first,
 * then addresses) until the payload clears both:
 *
 * - Capacity: a version-13 symbol at correction level L holds 425 bytes.
 * - Density: the card shows the code in a 128px box, and a phone camera
 *   wants roughly 1.5 CSS px per module, so anything denser than version
 *   13 (69 modules a side) is treated exactly like an over-capacity
 *   payload even though the QR format itself could encode it.
 *
 * Neither ceiling is guaranteed reachable — the schema caps count UTF-16
 * characters while QR capacity counts UTF-8 octets, so identity fields full
 * of multi-byte text can outgrow every tier. The card then renders without
 * a QR and points at the vCard download instead.
 */
const QR_PAYLOADS: VCardOptions[] = [
  {},
  { includeNotes: false },
  { includeNotes: false, includeAddresses: false },
];

const MAX_QR_VERSION = 13;

async function contactQrCode(contact: Contact): Promise<string | null> {
  for (const options of QR_PAYLOADS) {
    const payload = contactToVCard(contact, options);
    try {
      // Level L is the norm for on-screen codes — a backlit screen never
      // takes the damage higher levels guard against — and buys the most
      // capacity per module.
      const symbol = QRCode.create(payload, { errorCorrectionLevel: "L" });
      if (symbol.version > MAX_QR_VERSION) continue;
      return await QRCode.toDataURL(payload, {
        margin: 1,
        width: 256,
        errorCorrectionLevel: "L",
      });
    } catch {
      // Too large for any QR symbol at all — retry with a slimmer vCard.
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
