import { describe, it, expect } from "vitest";
import { normalizeForSearch, tokenize, searchMaterials } from "../searchMaterials";

describe("normalizeForSearch", () => {
  it("lowercases", () => {
    expect(normalizeForSearch("Block")).toBe("block");
  });
  it("folds arabic-indic digits", () => {
    expect(normalizeForSearch("٢٠")).toBe("20");
  });
  it("normalizes alif and ya variants", () => {
    expect(normalizeForSearch("إسمنت")).toBe("اسمنت");
    expect(normalizeForSearch("بنى")).toBe("بني");
  });
});

describe("tokenize", () => {
  it("splits on whitespace and punctuation", () => {
    expect(tokenize("isolated 20cm 4-hole")).toEqual(["isolated", "20cm", "4", "hole"]);
  });
  it("dedupes tokens", () => {
    expect(tokenize("block block 20")).toEqual(["block", "20"]);
  });
  it("returns empty for empty query", () => {
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("searchMaterials", () => {
  function mockClient(rows: Array<{ material_id: string; bag: string; code: string | null }>) {
    return {
      from() {
        return {
          select() { return this; },
          or() { return this; },
          eq() { return this; },
          limit() {
            return Promise.resolve({
              data: rows.map((r) => ({
                material_id: r.material_id,
                subcategory_id: null,
                category_id: null,
                code: r.code,
                display_en: r.bag,
                display_ar: null,
                bag: r.bag,
              })),
              error: null,
            });
          },
        };
      },
    } as any;
  }

  it("matches alias terms and scores above threshold", async () => {
    const client = mockClient([
      { material_id: "m1", bag: "Block bb-20-4h isolated 20 cm 4 holes", code: "MAT.BB.01.231.20" },
      { material_id: "m2", bag: "Sand fine washed", code: "MAT.SA.01.0.0" },
    ]);
    const hits = await searchMaterials("isolated 20cm 4 hole", { client });
    expect(hits[0]?.material_id).toBe("m1");
  });

  it("rewards exact code match", async () => {
    const client = mockClient([
      { material_id: "m1", bag: "Block 20cm", code: "MAT.BB.01.231.20" },
      { material_id: "m2", bag: "Block 20cm with extra label MAT.BB.01.231.20 mentioned", code: "MAT.OTHER.01.000.00" },
    ]);
    const hits = await searchMaterials("MAT.BB.01.231.20", { client });
    expect(hits[0]?.material_id).toBe("m1");
    expect(hits[0]?.score).toBeGreaterThan(1);
  });

  it("handles arabic query", async () => {
    const client = mockClient([
      { material_id: "m1", bag: "بلوك معزول ٢٠ سم", code: "MAT.BB.01.231.20" },
    ]);
    const hits = await searchMaterials("معزول 20", { client });
    expect(hits[0]?.material_id).toBe("m1");
  });

  it("returns empty for empty query", async () => {
    const client = mockClient([{ material_id: "m1", bag: "x", code: null }]);
    expect(await searchMaterials("", { client })).toEqual([]);
  });
});
