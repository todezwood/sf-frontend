import { z } from "zod";
import { ADDRESS_TYPES } from "./types";
import type { AddressFormValues, AddressInput, ContactInput } from "./types";

/**
 * Client/server-shared validation for the contact form.
 *
 * The rules mirror the API's Pydantic models (`ContactCreate` / `ContactReplace`)
 * so the user sees a mistake before a round trip — the API stays the authority,
 * and anything it rejects anyway is surfaced by `toFieldErrors` in `./api.ts`.
 */

/** Optional text: trimmed, and blank becomes `null` (the API clears the field). */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .default(null);
}

function requiredText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
}

/** One address row; mirrors the API's `AddressCreate`. */
export const addressInputSchema = z.object({
  type: z.enum(ADDRESS_TYPES),
  street: optionalText(300, "Street"),
  city: optionalText(120, "City"),
  state: optionalText(120, "State"),
  postal_code: optionalText(20, "Postal code"),
  country: optionalText(120, "Country"),
}) satisfies z.ZodType<AddressInput, unknown>;

export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
  last_name: requiredText(100, "Last name"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer")
    .pipe(z.email("Enter a valid email address"))
    .transform((value) => value.toLowerCase()),
  phone: optionalText(40, "Phone"),
  company: optionalText(200, "Company"),
  job_title: optionalText(200, "Job title"),
  addresses: z
    .array(addressInputSchema)
    .max(10, "A contact can have at most 10 addresses")
    .default([]),
  notes: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
  // Mirrors the API's photo rules: an image-only data URL (no SVG), bounded
  // in size. The value arrives from the server action, not a text input.
  photo: z
    .string()
    .regex(
      /^data:image\/(png|jpeg|webp|gif);base64,.+/,
      "Photo must be a PNG, JPEG, WebP, or GIF image",
    )
    .max(2_000_000, "Photo is too large — about 1.5 MB is the maximum")
    .nullable()
    .default(null),
}) satisfies z.ZodType<ContactInput, unknown>;

export type ContactFormValues = z.input<typeof contactInputSchema>;

/** Collapse a ZodError into one message per field, keyed by input name. */
export function zodFieldErrors(
  error: z.ZodError,
): Partial<Record<keyof ContactInput, string>> {
  const fieldErrors: Partial<Record<keyof ContactInput, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key as keyof ContactInput] = issue.message;
    }
  }
  return fieldErrors;
}

/* ------------------------------------------------------------------ */
/* Form metadata — one source of truth for the fields and their limits */
/* ------------------------------------------------------------------ */

/** The flat text fields; photo and addresses have dedicated form sections. */
export type ContactTextField = Exclude<keyof ContactInput, "photo" | "addresses">;

export interface ContactFieldSpec {
  name: ContactTextField;
  label: string;
  type?: "text" | "email" | "tel" | "textarea";
  required?: boolean;
  maxLength: number;
  placeholder?: string;
  autoComplete?: string;
  /** Column span inside the section grid. */
  wide?: boolean;
}

export interface ContactFieldGroup {
  title: string;
  description: string;
  fields: ContactFieldSpec[];
}

export const CONTACT_FIELD_GROUPS: ContactFieldGroup[] = [
  {
    title: "Identity",
    description: "First name, last name, and email are required.",
    fields: [
      {
        name: "first_name",
        label: "First name",
        required: true,
        maxLength: 100,
        placeholder: "Ada",
        autoComplete: "given-name",
      },
      {
        name: "last_name",
        label: "Last name",
        required: true,
        maxLength: 100,
        placeholder: "Lovelace",
        autoComplete: "family-name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        maxLength: 320,
        placeholder: "ada@example.com",
        autoComplete: "email",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        maxLength: 40,
        placeholder: "+1-415-555-0101",
        autoComplete: "tel",
      },
    ],
  },
  {
    title: "Work",
    description: "Where they work and what they do.",
    fields: [
      {
        name: "company",
        label: "Company",
        maxLength: 200,
        placeholder: "Analytical Engines",
        autoComplete: "organization",
      },
      {
        name: "job_title",
        label: "Job title",
        maxLength: 200,
        placeholder: "Mathematician",
        autoComplete: "organization-title",
      },
    ],
  },
  {
    title: "Notes",
    description: "Anything worth remembering. No length limit.",
    fields: [
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        maxLength: 10_000,
        placeholder: "Met at the SF hackathon.",
        wide: true,
      },
    ],
  },
];

export const CONTACT_FIELDS: ContactFieldSpec[] = CONTACT_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

/**
 * Pull the flat contact fields out of a submitted form, as raw strings. The
 * photo (a File) and the address rows (indexed names) are extracted
 * separately by the server action.
 */
export function formDataToValues(
  formData: FormData,
): Record<Exclude<keyof ContactInput, "photo" | "addresses">, string> {
  return Object.fromEntries(
    CONTACT_FIELDS.map((field) => [
      field.name,
      String(formData.get(field.name) ?? ""),
    ]),
  ) as Record<Exclude<keyof ContactInput, "photo" | "addresses">, string>;
}

/**
 * Pull the indexed address rows (`addresses[0][city]`, …) out of a submitted
 * form, as raw strings. Row order follows the form; a row exists as long as
 * its `type` select was submitted.
 */
export function formDataToAddresses(formData: FormData): AddressFormValues[] {
  const rows: AddressFormValues[] = [];
  for (let index = 0; formData.has(`addresses[${index}][type]`); index += 1) {
    const value = (name: keyof AddressInput) =>
      String(formData.get(`addresses[${index}][${name}]`) ?? "");
    rows.push({
      type: value("type"),
      street: value("street"),
      city: value("city"),
      state: value("state"),
      postal_code: value("postal_code"),
      country: value("country"),
    });
  }
  return rows;
}
