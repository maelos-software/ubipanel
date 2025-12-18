import { describe, it, expect } from "vitest";
import { validateQuery } from "../../server/lib/validateQuery.js";

describe("validateQuery", () => {
  describe("valid queries", () => {
    it("allows SELECT queries", () => {
      expect(validateQuery("SELECT * FROM clients")).toEqual({ valid: true });
      expect(validateQuery("SELECT last(cpu) FROM uap")).toEqual({ valid: true });
    });

    it("allows SELECT with WHERE clause", () => {
      expect(validateQuery("SELECT * FROM clients WHERE time > now() - 5m")).toEqual({
        valid: true,
      });
    });

    it("allows SELECT with GROUP BY", () => {
      expect(validateQuery('SELECT mean(cpu) FROM uap GROUP BY "name"')).toEqual({ valid: true });
    });

    it("allows SHOW queries", () => {
      expect(validateQuery("SHOW MEASUREMENTS")).toEqual({ valid: true });
      expect(validateQuery("SHOW TAG KEYS FROM clients")).toEqual({ valid: true });
      expect(validateQuery("SHOW FIELD KEYS FROM uap")).toEqual({ valid: true });
    });

    it("handles queries with extra whitespace", () => {
      expect(validateQuery("  SELECT  *  FROM  clients  ")).toEqual({ valid: true });
      expect(validateQuery("SELECT\n*\nFROM\nclients")).toEqual({ valid: true });
    });

    it("is case-insensitive for SELECT/SHOW", () => {
      expect(validateQuery("select * from clients")).toEqual({ valid: true });
      expect(validateQuery("Select * From Clients")).toEqual({ valid: true });
      expect(validateQuery("show measurements")).toEqual({ valid: true });
    });
  });

  describe("invalid input", () => {
    it("rejects null/undefined", () => {
      expect(validateQuery(null as unknown as string)).toEqual({
        valid: false,
        error: "Query must be a non-empty string",
      });
      expect(validateQuery(undefined as unknown as string)).toEqual({
        valid: false,
        error: "Query must be a non-empty string",
      });
    });

    it("rejects empty string", () => {
      expect(validateQuery("")).toEqual({
        valid: false,
        error: "Query must be a non-empty string",
      });
    });

    it("rejects non-string types", () => {
      expect(validateQuery(123 as unknown as string)).toEqual({
        valid: false,
        error: "Query must be a non-empty string",
      });
      expect(validateQuery({} as unknown as string)).toEqual({
        valid: false,
        error: "Query must be a non-empty string",
      });
    });
  });

  describe("blocked statement types", () => {
    it("rejects DROP statements", () => {
      expect(validateQuery("DROP MEASUREMENT clients")).toEqual({
        valid: false,
        error: "Only SELECT and SHOW queries are allowed",
      });
    });

    it("rejects DELETE statements", () => {
      expect(validateQuery("DELETE FROM clients")).toEqual({
        valid: false,
        error: "Only SELECT and SHOW queries are allowed",
      });
    });

    it("rejects CREATE statements", () => {
      expect(validateQuery("CREATE DATABASE test")).toEqual({
        valid: false,
        error: "Only SELECT and SHOW queries are allowed",
      });
    });

    it("rejects INSERT statements", () => {
      expect(validateQuery("INSERT INTO clients VALUES (1)")).toEqual({
        valid: false,
        error: "Only SELECT and SHOW queries are allowed",
      });
    });
  });

  describe("blocked keywords within queries", () => {
    it("blocks DROP keyword in SELECT", () => {
      const result = validateQuery("SELECT * FROM clients; DROP MEASUREMENT clients");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Forbidden keyword: DROP");
    });

    it("blocks DELETE keyword in SELECT", () => {
      const result = validateQuery("SELECT * FROM clients; DELETE FROM clients");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Forbidden keyword: DELETE");
    });

    it("blocks CREATE keyword in SELECT", () => {
      const result = validateQuery("SELECT * FROM clients; CREATE DATABASE evil");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Forbidden keyword: CREATE");
    });

    it("blocks ALTER keyword", () => {
      const result = validateQuery("SELECT * FROM clients; ALTER RETENTION POLICY");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Forbidden keyword: ALTER");
    });

    it("blocks GRANT keyword", () => {
      const result = validateQuery("SELECT * FROM clients; GRANT ALL TO admin");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Forbidden keyword: GRANT");
    });

    it("blocks REVOKE keyword", () => {
      const result = validateQuery("SELECT * FROM clients; REVOKE ALL FROM user");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Forbidden keyword: REVOKE");
    });

    it("blocks INSERT keyword", () => {
      const result = validateQuery("SELECT * FROM clients; INSERT INTO evil");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Forbidden keyword: INSERT");
    });

    it("blocks INTO keyword (SELECT INTO)", () => {
      const result = validateQuery("SELECT * INTO evil_copy FROM clients");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Forbidden keyword: INTO");
    });

    it("blocks KILL keyword", () => {
      const result = validateQuery("SELECT * FROM clients; KILL QUERY 1");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Forbidden keyword: KILL");
    });
  });

  describe("cross-database access prevention", () => {
    it("blocks fully qualified measurement names", () => {
      const result = validateQuery("SELECT * FROM other_db..clients");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Cross-database queries are not allowed");
    });

    it("blocks quoted database names", () => {
      const result = validateQuery('SELECT * FROM "other_db"..clients');
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Cross-database queries are not allowed");
    });

    it("allows normal FROM clauses", () => {
      expect(validateQuery("SELECT * FROM clients")).toEqual({ valid: true });
      expect(validateQuery('SELECT * FROM "clients"')).toEqual({ valid: true });
    });
  });

  describe("edge cases", () => {
    it("allows column names that contain blocked words as substrings", () => {
      // "drop_count" contains "drop" but as part of identifier, not as keyword
      expect(validateQuery("SELECT drop_count FROM clients")).toEqual({ valid: true });
      expect(validateQuery("SELECT deleted_at FROM clients")).toEqual({ valid: true });
      expect(validateQuery("SELECT create_time FROM clients")).toEqual({ valid: true });
    });

    it("allows measurement names with blocked words as substrings", () => {
      expect(validateQuery("SELECT * FROM dropped_clients")).toEqual({ valid: true });
      expect(validateQuery("SELECT * FROM user_grants")).toEqual({ valid: true });
    });

    it("handles complex real-world queries", () => {
      const complexQuery = `
        SELECT last(rx_bytes) as rx_bytes, last(tx_bytes) as tx_bytes,
               last("rx_bytes_r") as rx_bytes_r, last("tx_bytes_r") as tx_bytes_r,
               last(signal) as signal, last(rssi) as rssi
        FROM clients
        WHERE time > now() - 5m
        GROUP BY "mac", "name", "ap_name"
      `;
      expect(validateQuery(complexQuery)).toEqual({ valid: true });
    });
  });
});
