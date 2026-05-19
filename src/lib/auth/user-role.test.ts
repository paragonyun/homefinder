import { describe, expect, it } from "vitest";
import { getRoleFromAppMetadata, isAdminRole } from "./user-role";

describe("isAdminRole", () => {
  it("allows only the admin role to mutate HomeScope data", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("viewer")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});

describe("getRoleFromAppMetadata", () => {
  it("reads a string role from Supabase app metadata", () => {
    expect(getRoleFromAppMetadata({ role: "admin" })).toBe("admin");
  });

  it("ignores missing or non-string roles", () => {
    expect(getRoleFromAppMetadata({ role: ["admin"] })).toBeNull();
    expect(getRoleFromAppMetadata({})).toBeNull();
    expect(getRoleFromAppMetadata(null)).toBeNull();
  });
});
