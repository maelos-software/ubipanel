/**
 * InfluxQL query validator - only allow safe read operations
 * Exported for testing
 */
export function validateQuery(query) {
  if (!query || typeof query !== "string") {
    return { valid: false, error: "Query must be a non-empty string" };
  }

  // Normalize: collapse whitespace, trim
  const normalized = query.replace(/\s+/g, " ").trim().toUpperCase();

  // Only allow SELECT and SHOW statements
  if (!normalized.startsWith("SELECT ") && !normalized.startsWith("SHOW ")) {
    return { valid: false, error: "Only SELECT and SHOW queries are allowed" };
  }

  // Block dangerous keywords that could modify data or schema
  const blockedKeywords = [
    "DROP",
    "DELETE",
    "CREATE",
    "ALTER",
    "GRANT",
    "REVOKE",
    "INSERT",
    "INTO", // SELECT INTO creates new measurements
    "KILL",
  ];

  for (const keyword of blockedKeywords) {
    // Match keyword as whole word (not part of identifier)
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(query)) {
      return { valid: false, error: `Forbidden keyword: ${keyword}` };
    }
  }

  // Block attempts to access other databases via fully qualified names
  // Pattern: FROM "other_db".."measurement" or FROM other_db..measurement
  if (/FROM\s+["']?\w+["']?\s*\.\./i.test(query)) {
    return { valid: false, error: "Cross-database queries are not allowed" };
  }

  return { valid: true };
}
