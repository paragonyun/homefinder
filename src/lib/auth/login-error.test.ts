import { describe, expect, it } from "vitest";
import { formatLoginErrorMessage } from "./login-error";

describe("formatLoginErrorMessage", () => {
  it("explains Supabase network failures instead of showing the raw fetch error", () => {
    expect(formatLoginErrorMessage({ message: "Failed to fetch" })).toBe(
      "Supabase Auth 서버에 연결할 수 없습니다. NEXT_PUBLIC_SUPABASE_URL이 살아 있는 프로젝트 URL인지 확인하고 개발 서버를 다시 시작하세요.",
    );
  });

  it("keeps ordinary auth errors from Supabase", () => {
    expect(formatLoginErrorMessage({ message: "Invalid login credentials" })).toBe(
      "Invalid login credentials",
    );
  });

  it("falls back when the error has no useful message", () => {
    expect(formatLoginErrorMessage(null)).toBe("로그인에 실패했습니다.");
  });
});
