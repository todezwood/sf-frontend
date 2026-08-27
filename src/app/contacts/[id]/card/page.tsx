import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ChevronLeft, Download } from "lucide-react";
import ContactCard from "@/components/contacts/ContactCard";
import { buttonClasses } from "@/components/ui/Button";
import { getContact } from "@/lib/contacts/api";
import { contactStats } from "@/lib/contacts/stats";
import { contactToVCard } from "@/lib/contacts/vcard";

type PageProps = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 1) notFound();
  return id;
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
  const qrDataUrl = await QRCode.toDataURL(contactToVCard(contact), {
    margin: 1,
    width: 240,
  });

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
