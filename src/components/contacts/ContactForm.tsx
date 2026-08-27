"use client";

import { useActionState, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import Field from "@/components/ui/Field";
import Button, { buttonClasses } from "@/components/ui/Button";
import { CONTACT_FIELD_GROUPS } from "@/lib/contacts/schema";
import {
  EMPTY_FORM_STATE,
  type Contact,
  type ContactInput,
  type FormState,
} from "@/lib/contacts/types";

export type ContactFormAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;

/** Keep uploads comfortably under the API's ~1.4 MB decoded cap. */
const MAX_PHOTO_BYTES = 1_000_000;

/**
 * Photo upload lives outside the metadata-driven field loop: it is a file
 * input, not a text value, and the server action reads the File directly.
 */
function PhotoField({
  contact,
  message,
  pendingPhoto,
  onFileChange,
}: {
  contact?: Contact;
  message?: string;
  /** Photo carried over from a failed submit — file inputs cannot re-populate. */
  pendingPhoto?: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">Photo</legend>

      <div className="border-b border-hairline pb-2">
        <h2 className="font-display text-sm font-semibold text-foreground">
          Photo
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Optional profile photo, shown as a circular avatar.
        </p>
      </div>

      <div className="flex items-center gap-4">
        {contact ? <ContactAvatar contact={contact} size="lg" /> : null}
        <div className="min-w-0 flex-1">
          <label
            htmlFor="field-photo"
            className="mb-1.5 block text-[13px] font-medium text-foreground"
          >
            Photo
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
              optional
            </span>
          </label>
          <input
            id="field-photo"
            name="photo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? "field-photo-error" : undefined}
            className={`block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:bg-input file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground ${
              message ? "file:border-destructive" : "file:border-border"
            }`}
            onChange={onFileChange}
          />
          {message ? (
            <p
              id="field-photo-error"
              role="alert"
              className="mt-1.5 text-[13px] text-destructive"
            >
              {message}
            </p>
          ) : null}
          {pendingPhoto ? (
            <input type="hidden" name="pending_photo" value={pendingPhoto} />
          ) : null}
          {pendingPhoto && !message ? (
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Your selected photo was kept — no need to choose it again.
            </p>
          ) : null}
          {contact?.photo ? (
            <label className="mt-1.5 flex items-center gap-2 text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                name="remove_photo"
                className="h-3.5 w-3.5 accent-current"
              />
              Remove current photo
            </label>
          ) : null}
          {contact?.photo && !pendingPhoto && !message ? (
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Leave empty to keep the current photo.
            </p>
          ) : null}
        </div>
      </div>
    </fieldset>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : null}
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * Create/edit form. The field list comes from `CONTACT_FIELD_GROUPS`, and the
 * action is a bound server action — so a submit is a plain POST that works
 * before hydration and reports errors through `useActionState`.
 */
export default function ContactForm({
  action,
  contact,
  submitLabel,
  cancelHref,
}: {
  action: ContactFormAction;
  contact?: Contact;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const [photoSizeError, setPhotoSizeError] = useState<string | null>(null);
  const [photoDirty, setPhotoDirty] = useState(false);

  function valueFor(name: keyof ContactInput): string {
    return state.values?.[name] ?? contact?.[name] ?? "";
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setPhotoDirty(true);
    const file = event.target.files?.[0];
    if (file && file.size > MAX_PHOTO_BYTES) {
      setPhotoSizeError("Photo must be 1 MB or smaller.");
      event.target.value = "";
    } else {
      setPhotoSizeError(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // A fresh submit should surface fresh server errors again.
    setPhotoDirty(false);
    if (photoSizeError) event.preventDefault();
  }

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={handleSubmit}
      className="space-y-8"
    >
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-foreground"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>{state.message}</span>
        </div>
      ) : null}

      <PhotoField
        contact={contact}
        message={
          photoSizeError ??
          (photoDirty ? undefined : state.fieldErrors?.photo)
        }
        pendingPhoto={state.values?.photo}
        onFileChange={handlePhotoChange}
      />

      {CONTACT_FIELD_GROUPS.map((group) => (
        <fieldset key={group.title} className="space-y-4">
          <legend className="sr-only">{group.title}</legend>

          <div className="border-b border-hairline pb-2">
            <h2 className="font-display text-sm font-semibold text-foreground">
              {group.title}
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {group.description}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((field) => (
              <Field
                key={field.name}
                field={field}
                defaultValue={valueFor(field.name)}
                error={state.fieldErrors?.[field.name]}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex items-center gap-2 border-t border-hairline pt-4">
        <SubmitButton label={submitLabel} />
        <Link href={cancelHref} className={buttonClasses("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
