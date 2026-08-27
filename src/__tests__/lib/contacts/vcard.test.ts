import { contactToVCard, escapeVCardText } from "@/lib/contacts/vcard";
import { makeContact } from "../../mocks/handlers";

describe("escapeVCardText", () => {
  it("escapes the vCard special characters", () => {
    expect(escapeVCardText("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
    expect(escapeVCardText("line one\nline two")).toBe("line one\\nline two");
  });
});

describe("contactToVCard", () => {
  it("serialises the identity and the addresses", () => {
    const vcard = contactToVCard(makeContact());
    const lines = vcard.split("\r\n");

    expect(lines[0]).toBe("BEGIN:VCARD");
    expect(lines[lines.length - 1]).toBe("END:VCARD");
    expect(lines).toContain("N:Lovelace;Ada;;;");
    expect(lines).toContain("FN:Ada Lovelace");
    expect(lines).toContain("EMAIL;TYPE=INTERNET:ada@example.com");
    expect(lines).toContain("ADR;TYPE=WORK:;;;San Francisco;CA;;USA");
  });

  it("escapes values that carry separators", () => {
    const vcard = contactToVCard(
      makeContact({ company: "Engines; Analytical, Ltd" }),
    );
    expect(vcard).toContain("ORG:Engines\\; Analytical\\, Ltd");
  });

  it("only embeds the photo when asked to", () => {
    const contact = makeContact({ photo: "data:image/png;base64,iVBORw0KGgo=" });

    expect(contactToVCard(contact)).not.toContain("PHOTO");
    expect(contactToVCard(contact, { includePhoto: true })).toContain(
      "PHOTO;ENCODING=b;TYPE=PNG:iVBORw0KGgo=",
    );
  });
});
