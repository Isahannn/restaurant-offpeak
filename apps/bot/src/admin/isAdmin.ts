export function isAdmin(telegramUserId: number, adminIdsEnv: string | undefined): boolean {
  if (!adminIdsEnv) return false;

  const adminIds = adminIdsEnv
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map(Number);

  return adminIds.includes(telegramUserId);
}
