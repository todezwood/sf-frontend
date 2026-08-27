import { contactStats } from "@/lib/contacts/stats";
import { makeContact } from "../../mocks/handlers";

describe("contactStats", () => {
  const sparse = makeContact({
    phone: null,
    company: null,
    job_title: null,
    addresses: [],
    notes: null,
    photo: null,
  });

  it("keeps every stat in the 1-99 range", () => {
    for (const value of Object.values(contactStats(sparse))) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(99);
    }
  });

  it("levels the card up as the record gets richer", () => {
    const sparseStats = contactStats(sparse);
    const richStats = contactStats(
      makeContact({
        notes: "Met at the SF hackathon, follow up about the demo.",
        photo: "data:image/png;base64,iVBORw0KGgo=",
      }),
    );

    expect(richStats.power).toBeGreaterThan(sparseStats.power);
    expect(richStats.visual).toBe(99);
    expect(sparseStats.visual).toBeLessThan(50);
  });

  it("scores footprint by address coverage", () => {
    const one = contactStats(makeContact());
    const none = contactStats(makeContact({ addresses: [] }));
    expect(one.footprint).toBeGreaterThan(none.footprint);
  });
});
