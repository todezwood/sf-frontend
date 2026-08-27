import {
  contactToVCard,
  escapeVCardText,
  foldVCardLine,
} from "@/lib/contacts/vcard";
import { makeContact } from "../../mocks/handlers";

const utf8Length = (text: string) => new TextEncoder().encode(text).length;

describe("escapeVCardText", () => {
  it("escapes the vCard special characters", () => {
    expect(escapeVCardText("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
    expect(escapeVCardText("line one\nline two")).toBe("line one\\nline two");
  });
});

describe("foldVCardLine", () => {
  it("leaves short lines alone", () => {
    expect(foldVCardLine("FN:Ada Lovelace")).toEqual(["FN:Ada Lovelace"]);
  });

  it("folds at 75 octets with space-led continuations", () => {
    const folded = foldVCardLine(`NOTE:${"x".repeat(200)}`);

    expect(folded.length).toBeGreaterThan(1);
    for (const line of folded) expect(utf8Length(line)).toBeLessThanOrEqual(75);
    for (const line of folded.slice(1)) expect(line.startsWith(" ")).toBe(true);
    // Unfolding (strip each continuation's leading space) restores the line.
    expect(folded[0] + folded.slice(1).map((l) => l.slice(1)).join("")).toBe(
      `NOTE:${"x".repeat(200)}`,
    );
  });

  it("never splits a multi-byte character", () => {
    const folded = foldVCardLine(`NOTE:${"é".repeat(120)}`);

    for (const line of folded) {
      expect(utf8Length(line)).toBeLessThanOrEqual(75);
      // A broken character would decode as the replacement character.
      expect(line).not.toContain("�");
    }
  });
});

describe("contactToVCard", () => {
  it("serialises the identity and the addresses", () => {
    const vcard = contactToVCard(makeContact());
    const lines = vcard.split("\r\n");

    expect(lines[0]).toBe("BEGIN:VCARD");
    expect(vcard.endsWith("END:VCARD\r\n")).toBe(true);
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

  it("keeps every physical line within 75 octets", () => {
    const contact = makeContact({
      notes: "n".repeat(500),
      photo: `data:image/png;base64,${"A".repeat(4000)}`,
    });
    const lines = contactToVCard(contact, { includePhoto: true }).split("\r\n");

    for (const line of lines) expect(utf8Length(line)).toBeLessThanOrEqual(75);
  });

  it("can shed the addresses and the notes for tight payloads", () => {
    const contact = makeContact({ notes: "Met at the Analytical Engine expo" });
    const slim = contactToVCard(contact, {
      includeAddresses: false,
      includeNotes: false,
    });

    expect(slim).not.toContain("ADR");
    expect(slim).not.toContain("NOTE");
    expect(slim).toContain("FN:Ada Lovelace");
  });
});
