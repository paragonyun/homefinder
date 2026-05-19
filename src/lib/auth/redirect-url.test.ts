import { describe, expect, it } from "vitest";
import { getAuthCallbackUrl, getSafeAuthRedirectPath } from "./redirect-url";

describe("getAuthCallbackUrl", () => {
  it("builds an auth callback URL with the next app path", () => {
    expect(getAuthCallbackUrl("https://homefinder-opal.vercel.app", "/settings")).toBe(
      "https://homefinder-opal.vercel.app/auth/callback?next=%2Fsettings",
    );
  });
});

describe("getSafeAuthRedirectPath", () => {
  it("keeps same-origin app paths", () => {
    expect(getSafeAuthRedirectPath("/apartments")).toBe("/apartments");
  });

  it("falls back when the next path is external or missing", () => {
    expect(getSafeAuthRedirectPath("https://example.com")).toBe("/settings");
    expect(getSafeAuthRedirectPath("//example.com")).toBe("/settings");
    expect(getSafeAuthRedirectPath(null)).toBe("/settings");
  });
});
