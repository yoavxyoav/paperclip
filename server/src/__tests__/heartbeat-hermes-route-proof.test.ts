import { describe, expect, it } from "vitest";
import { buildServerOwnedHermesRouteState } from "../services/heartbeat.js";

describe("server-owned Hermes route proof", () => {
  const trustedMeta = {
    adapterType: "hermes_local",
    command: "hermes",
    resolvedHermesRoute: {
      home: "/canonical/hermes/profile", provider: "custom", model: "gemma4:26b-128k",
      baseUrl: "http://10.0.0.9:11435/v1", provenance: "hermes_adapter_effective_config" as const,
    },
  };

  it("binds an adapter route proof to the server fingerprint", () => {
    expect(buildServerOwnedHermesRouteState("hermes_local", trustedMeta, "server-fingerprint")).toEqual({
      ...trustedMeta.resolvedHermesRoute,
      configFingerprint: "server-fingerprint",
      provenance: "server_adapter_invocation",
    });
  });

  it("rejects wrong provenance, provider, model, and missing endpoint", () => {
    expect(buildServerOwnedHermesRouteState("codex_local", trustedMeta, "fp")).toBeNull();
    expect(buildServerOwnedHermesRouteState("hermes_local", { ...trustedMeta,
      resolvedHermesRoute: { ...trustedMeta.resolvedHermesRoute, provenance: "task_output" as never } }, "fp")).toBeNull();
    expect(buildServerOwnedHermesRouteState("hermes_local", { ...trustedMeta,
      resolvedHermesRoute: { ...trustedMeta.resolvedHermesRoute, provider: "copilot" } }, "fp")).toBeNull();
    expect(buildServerOwnedHermesRouteState("hermes_local", { ...trustedMeta,
      resolvedHermesRoute: { ...trustedMeta.resolvedHermesRoute, model: "gpt-5.3-codex" } }, "fp")).toBeNull();
    expect(buildServerOwnedHermesRouteState("hermes_local", { ...trustedMeta,
      resolvedHermesRoute: { ...trustedMeta.resolvedHermesRoute, baseUrl: "" } }, "fp")).toBeNull();
  });
});
