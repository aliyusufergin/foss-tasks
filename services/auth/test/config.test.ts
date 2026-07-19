import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const base = {
  AUTH_JWT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
  AUTH_DATABASE_URL: "postgresql://u:p@db:5432/foss_tasks",
};

describe("loadConfig", () => {
  it("applies defaults for optional keys", () => {
    const cfg = loadConfig(base);
    expect(cfg.port).toBe(6060);
    expect(cfg.issuer).toBe("foss-tasks-auth");
    expect(cfg.audience).toBe("powersync");
    expect(cfg.tokenTtlSeconds).toBe(3600);
  });

  it("un-escapes literal \\n in the private key PEM", () => {
    const cfg = loadConfig(base);
    expect(cfg.privateKeyPem).toBe(
      "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
    );
  });

  it("reads only the passed env, not process.env", () => {
    const cfg = loadConfig({ ...base, AUTH_PORT: "7000" });
    expect(cfg.port).toBe(7000);
  });

  it("throws when a required key is missing", () => {
    expect(() => loadConfig({ AUTH_DATABASE_URL: "x" })).toThrow(
      /AUTH_JWT_PRIVATE_KEY/,
    );
  });

  it("throws on a non-integer numeric key", () => {
    expect(() => loadConfig({ ...base, AUTH_PORT: "not-a-number" })).toThrow(
      /AUTH_PORT/,
    );
  });
});
