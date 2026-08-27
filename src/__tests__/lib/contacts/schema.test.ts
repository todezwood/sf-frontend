import {
  CONTACT_FIELDS,
  contactInputSchema,
  formDataToValues,
  isBlankAddressRow,
  zodFieldErrors,
} from "@/lib/contacts/schema";

describe("isBlankAddressRow", () => {
  const blank = {
    type: "Home",
    street: "",
    city: "  ",
    state: "",
    postal_code: "",
    country: "",
  };

  it("treats an all-blank row as a placeholder regardless of type", () => {
    expect(isBlankAddressRow(blank)).toBe(true);
    expect(isBlankAddressRow({ ...blank, type: "Work" })).toBe(true);
  });

  it("keeps a row once any field is filled in", () => {
    expect(isBlankAddressRow({ ...blank, city: "London" })).toBe(false);
  });
});

function values(
  overrides: Record<string, string> = {},
  addresses: unknown[] = [],
) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    notes: "",
    addresses,
    ...overrides,
  };
}

describe("contactInputSchema photo rule", () => {
  it("accepts an image data URL and defaults to null", () => {
    const photo = "data:image/png;base64,iVBORw0KGgo=";
    expect(contactInputSchema.parse({ ...values(), photo }).photo).toBe(photo);
    expect(contactInputSchema.parse(values()).photo).toBeNull();
  });

  it("rejects an SVG data URL", () => {
    const result = contactInputSchema.safeParse({
      ...values(),
      photo: "data:image/svg+xml;base64,PHN2Zy8+",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an oversized photo", () => {
    const result = contactInputSchema.safeParse({
      ...values(),
      photo: `data:image/png;base64,${"A".repeat(2_000_000)}`,
    });
    expect(result.success).toBe(false);
  });
});

describe("contactInputSchema", () => {
  it("lowercases the email and nulls out the blanks", () => {
    const parsed = contactInputSchema.parse(values());

    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("trims what the user typed", () => {
    expect(contactInputSchema.parse(values({ company: "  Acme  " })).company).toBe(
      "Acme",
    );
  });

  it("requires the three fields the API requires", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: " ", last_name: "", email: "" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name is required",
      last_name: "Last name is required",
      email: "Email is required",
    });
  });

  it("rejects a malformed email", () => {
    const result = contactInputSchema.safeParse(values({ email: "not-an-email" }));
    expect(zodFieldErrors(result.error!).email).toBe("Enter a valid email address");
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: "a".repeat(101), company: "c".repeat(201) }),
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
      company: "Company must be 200 characters or fewer",
    });
  });

  it("validates nested address rows and caps the list", () => {
    const good = contactInputSchema.parse(
      values({}, [{ type: "Work", city: "San Francisco" }]),
    );
    expect(good.addresses).toEqual([
      {
        type: "Work",
        street: null,
        city: "San Francisco",
        state: null,
        postal_code: null,
        country: null,
      },
    ]);

    const badType = contactInputSchema.safeParse(
      values({}, [{ type: "Castle" }]),
    );
    expect(badType.success).toBe(false);

    const tooMany = contactInputSchema.safeParse(
      values({}, Array.from({ length: 11 }, () => ({ type: "Home" }))),
    );
    expect(zodFieldErrors(tooMany.error!).addresses).toBe(
      "A contact can have at most 10 addresses",
    );
  });
});

describe("formDataToValues", () => {
  it("pulls every known field out, defaulting to an empty string", () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.set("ignored", "nope");

    const extracted = formDataToValues(formData);

    expect(extracted.first_name).toBe("Grace");
    expect(extracted.last_name).toBe("");
    expect(Object.keys(extracted).sort()).toEqual(
      CONTACT_FIELDS.map((field) => field.name).sort(),
    );
  });
});
