import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@paperclipai/adapter-utils/server-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@paperclipai/adapter-utils/server-utils")>();
  return {
    ...actual,
    runChildProcess: vi.fn(async () => ({ exitCode: 0, signal: null, timedOut: false, stdout: "", stderr: "" })),
  };
});

vi.mock("node:fs/promises", () => {
  const readFile = vi.fn(async (file: unknown) => String(file).endsWith("config.yaml")
      ? "model:\n  default: gemma4:26b-128k\n  provider: custom\n  base_url: http://10.0.0.9:11435/v1\n"
      : "");
  return { readFile, default: {
    readFile,
    realpath: vi.fn(async (value: unknown) => String(value)),
    writeFile: vi.fn(), mkdir: vi.fn(), rm: vi.fn(), access: vi.fn(), readdir: vi.fn(async () => []),
    stat: vi.fn(async () => ({ isFile: () => true, isDirectory: () => false })),
  }};
});

import fs from "node:fs/promises";
import { execute } from "./execute.js";
import * as serverUtils from "@paperclipai/adapter-utils/server-utils";

function makeCtx(extra: Record<string, unknown> = {}) {
  return {
    runId: "route-proof-run",
    agent: { id: "agent-1", companyId: "company-1", name: "Hermes", adapterType: "hermes_local", adapterConfig: {} },
    runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
    runtimeTools: undefined,
    config: { command: "/usr/bin/hermes", model: "auto", env: { HERMES_HOME: "/profile" }, ...extra },
    context: { issueId: "issue-1", wakeReason: "manual", paperclipWake: null },
    onLog: vi.fn(async () => undefined),
    onMeta: vi.fn(async () => undefined),
    onSpawn: vi.fn(async () => undefined),
  } as any;
}

describe("Hermes effective route proof", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emits adapter-owned custom Gemma route metadata and leaves auto off argv", async () => {
    const ctx = makeCtx();
    await execute(ctx);
    expect(ctx.onMeta).toHaveBeenCalledWith(expect.objectContaining({ resolvedHermesRoute: {
      home: "/profile", provider: "custom", model: "gemma4:26b-128k",
      baseUrl: "http://10.0.0.9:11435/v1", provenance: "hermes_adapter_effective_config",
    }}));
    const argv = vi.mocked(serverUtils.runChildProcess).mock.calls[0]![2];
    expect(argv).not.toContain("-m");
    expect(argv).not.toContain("--provider");
  });

  it("rejects route-changing extra args before metadata or spawn", async () => {
    const ctx = makeCtx({ extraArgs: ["--provider=anthropic"] });
    await expect(execute(ctx)).rejects.toThrow("Hermes extraArgs flag is not permitted by route attestation: --provider");
    expect(serverUtils.runChildProcess).not.toHaveBeenCalled();
    expect(ctx.onMeta).not.toHaveBeenCalled();
  });

  it("rejects MiniMax China endpoint overrides before spawn", async () => {
    const ctx = makeCtx({ env: { HERMES_HOME: "/profile", MINIMAX_CN_BASE_URL: "https://invalid.example/v1" } });
    await expect(execute(ctx)).rejects.toThrow("Hermes environment route override is not attestable: MINIMAX_CN_BASE_URL");
    expect(serverUtils.runChildProcess).not.toHaveBeenCalled();
  });

  it("rejects profile endpoint overrides before spawn", async () => {
    vi.mocked(fs.readFile).mockImplementation(async (file: any) => String(file).endsWith(".env")
      ? "OPENAI_BASE_URL=https://invalid.example/v1\n"
      : "model:\n  default: gemma4:26b-128k\n  provider: custom\n  base_url: http://10.0.0.9:11435/v1\n");
    const ctx = makeCtx();
    await expect(execute(ctx)).rejects.toThrow("Hermes profile .env route override is not attestable: OPENAI_BASE_URL");
    expect(serverUtils.runChildProcess).not.toHaveBeenCalled();
  });
});
