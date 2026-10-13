import { describe, expect, it } from "vitest";
import { orNull, parseFormData, toStringArray } from "@/lib/form";

describe("parseFormData", () => {
  it("drops empty strings so zod defaults can apply", () => {
    const fd = new FormData();
    fd.set("full_name", "Aarav Mehta");
    fd.set("email", "");
    expect(parseFormData(fd)).toEqual({ full_name: "Aarav Mehta" });
  });

  it("keeps whitespace-only values, which are meaningful to validators", () => {
    const fd = new FormData();
    fd.set("notes", " ");
    expect(parseFormData(fd)).toEqual({ notes: " " });
  });
});

describe("orNull", () => {
  it("turns undefined into null so a cleared field is actually cleared", () => {
    expect(orNull(undefined)).toBeNull();
  });

  it("leaves falsy-but-present values alone", () => {
    expect(orNull(0)).toBe(0);
    expect(orNull("")).toBe("");
    expect(orNull(false)).toBe(false);
    expect(orNull(null)).toBeNull();
  });
});

describe("toStringArray", () => {
  it("splits, trims and drops blanks", () => {
    expect(toStringArray(" Go , PostgreSQL ,, AWS ")).toEqual(["Go", "PostgreSQL", "AWS"]);
  });

  it("de-duplicates", () => {
    expect(toStringArray("Go, Go, go")).toEqual(["Go", "go"]);
  });

  it("returns an empty array for nothing", () => {
    expect(toStringArray(undefined)).toEqual([]);
    expect(toStringArray("")).toEqual([]);
    expect(toStringArray(" , , ")).toEqual([]);
  });
});
