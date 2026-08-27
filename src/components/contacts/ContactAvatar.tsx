import type { CSSProperties } from "react";
import { avatarHue, initials } from "@/lib/contacts/format";
import type { Contact } from "@/lib/contacts/types";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

/**
 * Circular contact avatar: the stored photo when there is one, otherwise an
 * initials bubble tinted with a hue derived from the contact's email.
 */
export default function ContactAvatar({
  contact,
  size = "md",
}: {
  contact: Pick<Contact, "first_name" | "last_name" | "email" | "photo">;
  size?: keyof typeof SIZES;
}) {
  const style = {
    "--avatar-hue": avatarHue(contact.email),
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`contact-avatar inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-display font-semibold ${
        contact.photo ? "ring-1 ring-border" : ""
      } ${SIZES[size]}`}
    >
      {contact.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URLs gain nothing from next/image
        <img
          src={contact.photo}
          alt=""
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        initials(contact)
      )}
    </span>
  );
}
