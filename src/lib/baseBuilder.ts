// Base Builder Code attribution suffix (bc_eq8yb8s9)
// Append to calldata of any tx we sign & broadcast on Base via
// sendTransaction / sendCalls / writeContract so it counts on the
// Base.dev builder leaderboard.
export const BASE_BUILDER_SUFFIX =
  "62635f65713879623873390b0080218021802180218021802180218021";

/**
 * Append the Base Builder suffix to calldata.
 * Safe for empty data, missing 0x prefix, and already-suffixed data.
 */
export function withBuilderAttribution(
  originalData?: `0x${string}` | string | null,
): `0x${string}` {
  const raw = originalData ?? "0x";
  const clean = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (clean.toLowerCase().endsWith(BASE_BUILDER_SUFFIX.toLowerCase())) {
    return clean as `0x${string}`;
  }
  return `${clean}${BASE_BUILDER_SUFFIX}` as `0x${string}`;
}
