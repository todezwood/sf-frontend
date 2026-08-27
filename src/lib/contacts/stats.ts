import type { Contact } from "./types";

/**
 * Trading-card stats, derived entirely from how complete the contact record
 * is — every number is earned by filling the relationship in, nothing is
 * random. The card literally levels up as you learn more about someone.
 */

export interface ContactStats {
  /** Overall rating, FIFA style. Weighted blend of the others. */
  power: number;
  /** Can you actually reach them: email always, phone, somewhere to knock. */
  reach: number;
  /** What you know about them: notes richness. */
  intel: number;
  /** Where they exist in the world: address coverage. */
  footprint: number;
  /** A face to the name: photo on file. */
  visual: number;
}

/** Display metadata for the stat block, in card order. */
export const STAT_LABELS: { key: keyof ContactStats; label: string }[] = [
  { key: "reach", label: "RCH" },
  { key: "intel", label: "INT" },
  { key: "footprint", label: "GEO" },
  { key: "visual", label: "VIS" },
];

const MAX = 99;

function clamp(value: number): number {
  return Math.max(1, Math.min(MAX, Math.round(value)));
}

export function contactStats(contact: Contact): ContactStats {
  // Email is guaranteed by the API, so reach starts at a working floor.
  const reach = clamp(
    40 + (contact.phone ? 40 : 0) + (contact.addresses.length > 0 ? 19 : 0),
  );
  const intel = clamp(
    contact.notes ? 55 + Math.min(44, contact.notes.length) : 8,
  );
  const footprint = clamp(contact.addresses.length * 33);
  const visual = contact.photo ? MAX : 12;
  const career = contact.company && contact.job_title ? MAX : 30;

  const power = clamp(
    reach * 0.25 + intel * 0.2 + footprint * 0.2 + visual * 0.2 + career * 0.15,
  );

  return { power, reach, intel, footprint, visual };
}
