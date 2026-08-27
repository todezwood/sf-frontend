import type { CSSProperties } from "react";
import { avatarHue, initials, jobLine } from "@/lib/contacts/format";
import { STAT_LABELS, type ContactStats } from "@/lib/contacts/stats";
import type { Contact } from "@/lib/contacts/types";

/**
 * Trading-card view of a contact. The tint comes from the contact's avatar
 * hue, so every card is personalised the same way the initials bubble is.
 * Deliberately dark in both themes — it is a collectible, not a page.
 */
export default function ContactCard({
  contact,
  stats,
  qrDataUrl,
}: {
  contact: Contact;
  stats: ContactStats;
  /** Null when even the slimmest vCard outgrew the QR symbol. */
  qrDataUrl: string | null;
}) {
  const style = { "--card-hue": avatarHue(contact.email) } as CSSProperties;
  const subtitle = jobLine(contact);

  return (
    <div
      style={style}
      className="w-full max-w-[340px] rounded-2xl border border-white/20 bg-[linear-gradient(160deg,hsl(var(--card-hue)_50%_26%),hsl(var(--card-hue)_65%_10%))] p-6 text-white shadow-2xl"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-5xl font-bold leading-none">
            {stats.power}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-widest text-white/70">
            Power
          </p>
        </div>
        {contact.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL avatar
          <img
            src={contact.photo}
            alt=""
            className="h-24 w-24 rounded-full object-cover ring-2 ring-white/40"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 font-display text-3xl font-semibold ring-2 ring-white/40"
          >
            {initials(contact)}
          </span>
        )}
      </div>

      <div className="mt-5 border-y border-white/20 py-3 text-center">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">
          {contact.full_name}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-[13px] text-white/70">{subtitle}</p>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
        {STAT_LABELS.map(({ key, label }) => (
          <div key={key}>
            <dt className="text-[10px] uppercase tracking-wide text-white/60">
              {label}
            </dt>
            <dd className="font-display text-2xl font-bold">{stats[key]}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="text-[12px] leading-snug text-white/70">
          {qrDataUrl
            ? `Scan to add ${contact.first_name} to your phone's contacts.`
            : "This record outgrew a QR code — grab the vCard download instead."}
        </p>
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated QR data URL
          <img
            src={qrDataUrl}
            alt={`QR code holding ${contact.full_name}'s contact card`}
            className="h-32 w-32 shrink-0 rounded-md bg-white p-1.5"
          />
        ) : null}
      </div>
    </div>
  );
}
