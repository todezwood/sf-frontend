"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, ApiUnreachableError } from "@/lib/apiClient";
import {
  apiErrorMessage,
  createContact,
  deleteContact,
  replaceContact,
  toFieldErrors,
  updateContact,
} from "@/lib/contacts/api";
import {
  contactInputSchema,
  formDataToAddresses,
  formDataToValues,
  isBlankAddressRow,
  zodFieldErrors,
} from "@/lib/contacts/schema";
import type { Contact, FormState } from "@/lib/contacts/types";

/** Mutations for the contacts UI. Every one of these runs only on the server. */

function invalidate(contactId?: number) {
  revalidatePath("/contacts");
  if (contactId) revalidatePath(`/contacts/${contactId}`);
}

const UNREACHABLE =
  "Could not reach the Contacts API. Check that the backend is running.";

/**
 * The client-side check mirrors this, but only after hydration — a plain
 * pre-hydration POST reaches us with whatever file the browser allowed, so
 * the size must be enforced here, before the base64 encode inflates it.
 */
const MAX_PHOTO_FILE_BYTES = 1_000_000;

type ResolvedPhoto =
  | { ok: true; photo: string | null | undefined }
  | { ok: false; error: string };

/**
 * Resolve the photo for a save, in priority order: a newly uploaded file, an
 * explicit "remove photo" request, then a photo carried over from a failed
 * submit (file inputs cannot be re-populated on a re-render). With none of
 * those, an edit resolves to `undefined` — "leave the stored photo untouched"
 * — which the caller honors by saving through PATCH instead of PUT.
 */
async function resolvePhoto(
  formData: FormData,
  contactId: number | null,
): Promise<ResolvedPhoto> {
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PHOTO_FILE_BYTES) {
      return { ok: false, error: "Photo must be 1 MB or smaller." };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    return { ok: true, photo: `data:${file.type};base64,${bytes.toString("base64")}` };
  }
  if (formData.get("remove_photo") === "on") {
    return { ok: true, photo: null };
  }
  const pending = formData.get("pending_photo");
  if (typeof pending === "string" && pending) {
    return { ok: true, photo: pending };
  }
  return { ok: true, photo: contactId === null ? null : undefined };
}

/**
 * Create (when `contactId` is null) or fully replace a contact.
 *
 * Bind the id at the call site — `saveContactAction.bind(null, contact.id)` —
 * so the form itself never carries a mutable record id.
 */
export async function saveContactAction(
  contactId: number | null,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formDataToValues(formData);
  // Untouched placeholder rows are not addresses — don't store blanks.
  const addressValues = formDataToAddresses(formData).filter(
    (row) => !isBlankAddressRow(row),
  );

  const resolved = await resolvePhoto(formData, contactId);
  if (!resolved.ok) {
    // Never echo a rejected upload — it would ride every retry as hidden
    // state and blow the request body budget all over again.
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { photo: resolved.error },
      values,
      addressValues,
    };
  }
  const photo = resolved.photo;
  // `null` on an edit is an explicit removal; remember it across a failed
  // submit so a corrected retry still removes the photo.
  const photoRemoved = contactId !== null && photo === null;

  // Echo the resolved photo so a failed submit keeps the pending upload.
  const echoed = { ...values, photo: photo ?? undefined };

  const parsed = contactInputSchema.safeParse({
    ...values,
    photo: photo ?? null,
    addresses: addressValues,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
      values: echoed, addressValues, photoRemoved,
    };
  }

  let saved: Contact;
  try {
    if (contactId === null) {
      saved = await createContact(parsed.data);
    } else if (photo === undefined) {
      // No photo change: PATCH writes every form field but omits the photo,
      // so the stored one is preserved without re-sending megabytes of it.
      const patch: Partial<typeof parsed.data> = { ...parsed.data };
      delete patch.photo;
      saved = await updateContact(contactId, patch);
    } else {
      saved = await replaceContact(contactId, parsed.data);
    }
  } catch (error) {
    if (error instanceof ApiUnreachableError) {
      return { status: "error", message: UNREACHABLE, values: echoed, addressValues, photoRemoved };
    }
    if (error instanceof ApiError) {
      if (error.status === 409) {
        return {
          status: "error",
          message: "That email address is already taken.",
          fieldErrors: {
            email: apiErrorMessage(error, "This email is already in use."),
          },
          values: echoed, addressValues, photoRemoved,
        };
      }
      if (error.status === 422) {
        return {
          status: "error",
          message: "The API rejected these values.",
          fieldErrors: toFieldErrors(error),
          values: echoed, addressValues, photoRemoved,
        };
      }
      return {
        status: "error",
        message: apiErrorMessage(error, "The contact could not be saved."),
        values: echoed, addressValues, photoRemoved,
      };
    }
    throw error;
  }

  invalidate(saved.id);
  // Outside the try/catch: redirect() signals by throwing.
  redirect(`/contacts/${saved.id}`);
}

export interface DeleteResult {
  error?: string;
}

/**
 * Delete a contact. Pass `redirectToList` from the detail page, where staying
 * put would leave the user on a 404.
 */
export async function deleteContactAction(
  contactId: number,
  redirectToList = false,
): Promise<DeleteResult> {
  try {
    await deleteContact(contactId);
  } catch (error) {
    if (error instanceof ApiUnreachableError) return { error: UNREACHABLE };
    if (error instanceof ApiError) {
      return {
        error:
          error.status === 404
            ? "That contact has already been deleted."
            : apiErrorMessage(error, "The contact could not be deleted."),
      };
    }
    throw error;
  }

  invalidate(contactId);
  if (redirectToList) redirect("/contacts");
  return {};
}
