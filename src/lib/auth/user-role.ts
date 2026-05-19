export type UserRole = "admin" | "viewer";

export function isAdminRole(role: string | null | undefined) {
  return role === "admin";
}

export function getRoleFromAppMetadata(
  appMetadata: Record<string, unknown> | null | undefined,
) {
  const role = appMetadata?.role;
  return typeof role === "string" ? role : null;
}
