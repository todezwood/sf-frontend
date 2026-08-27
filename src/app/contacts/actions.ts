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
  formDataToValues,
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
 * Resolve the photo for a save, in priority order: a newly uploaded file, an
 * explicit "remove photo" request, then a photo carried over from a failed
 * submit (file inputs cannot be re-populated on a re-render). With none of
 * those, an edit returns `undefined` — "leave the stored photo untouched" —
 * which the caller honors by saving through PATCH instead of PUT.
 */
async function resolvePhoto(
  formData: FormData,
  contactId: number | null,
): Promise<string | null | undefined> {
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    const bytes = Buffer.from(await file.arrayBuffer());
    return `data:${file.type};base64,${bytes.toString("base64")}`;
  }
  if (formData.get("remove_photo") === "on") {
    return null;
  }
  const pending = formData.get("pending_photo");
  if (typeof pending === "string" && pending) {
    return pending;
  }
  return contactId === null ? null : undefined;
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
  const photo = await resolvePhoto(formData, contactId);

  // Echo the resolved photo so a failed submit keeps the pending upload.
  const echoed = { ...values, photo: photo ?? undefined };

  const parsed = contactInputSchema.safeParse({ ...values, photo: photo ?? null });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
      values: echoed,
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
      return { status: "error", message: UNREACHABLE, values: echoed };
    }
    if (error instanceof ApiError) {
      if (error.status === 409) {
        return {
          status: "error",
          message: "That email address is already taken.",
          fieldErrors: {
            email: apiErrorMessage(error, "This email is already in use."),
          },
          values: echoed,
        };
      }
      if (error.status === 422) {
        return {
          status: "error",
          message: "The API rejected these values.",
          fieldErrors: toFieldErrors(error),
          values: echoed,
        };
      }
      return {
        status: "error",
        message: apiErrorMessage(error, "The contact could not be saved."),
        values: echoed,
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
