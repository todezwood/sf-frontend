import { getContact } from "@/lib/contacts/api";
import { contactToVCard } from "@/lib/contacts/vcard";

/**
 * Serve the contact as a downloadable .vcf. Unlike the QR code, the download
 * can afford the photo, so it ships the complete card.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return new Response("Not found", { status: 404 });
  }

  const contact = await getContact(id);
  if (!contact) {
    return new Response("Not found", { status: 404 });
  }

  const filename = `${contact.full_name.replace(/[^\w -]/g, "")}.vcf`;
  return new Response(contactToVCard(contact, { includePhoto: true }), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
