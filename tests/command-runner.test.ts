import { describe, expect, it } from "vitest";

import { installPackages, listAllowedCommands, resolveAllowedCommand } from "../src/command-runner.js";

describe("command-runner", () => {
  it("resolves allowed command aliases and labels", () => {
    expect(resolveAllowedCommand("npm run build")?.id).toBe("build");
    expect(resolveAllowedCommand("build")?.id).toBe("build");
    expect(resolveAllowedCommand("git status")?.id).toBe("git-status");
    expect(resolveAllowedCommand("git diff")?.id).toBe("git-diff");
  });

  it("rejects dangerous shell commands", () => {
    expect(resolveAllowedCommand("rm -rf .")).toBeNull();
    expect(resolveAllowedCommand("powershell Remove-Item -Recurse .")).toBeNull();
  });

  it("rejects invalid package names before spawning npm", async () => {
    await expect(installPackages(process.cwd(), "npm", ["bad;package"], false)).rejects.toThrow("Lista de pacotes invalida");
  });

  it("does not list dangerous commands", () => {
    const allowed = listAllowedCommands();
    expect(allowed).not.toContain("rm");
    expect(allowed).not.toContain("powershell");
    expect(allowed).not.toContain("cmd");
  });
});
