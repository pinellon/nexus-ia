import { describe, expect, it } from "vitest";

import { selectContextFiles } from "../src/app/ai/context-builder.js";

const files = [
  "package.json",
  "tsconfig.json",
  "README.md",
  "public/index.html",
  "public/styles.css",
  "src/server.ts",
  "src/app/web/server.ts",
  "src/App.tsx",
  "src/components/Login.tsx",
  "docs/architecture.md"
];

describe("ContextBuilder file selection", () => {
  it("prioritizes active and open files from IDE context", () => {
    const selected = selectContextFiles(
      "melhore essa tela",
      files,
      "Arquivo ativo: src/components/Login.tsx\nArquivos abertos: src/App.tsx, public/index.html"
    );

    expect(selected).toContain("src/components/Login.tsx");
    expect(selected).toContain("src/App.tsx");
    expect(selected).toContain("public/index.html");
  });

  it("selects config and referenced files for build/typecheck errors", () => {
    const selected = selectContextFiles(
      "corrija o erro do build em src/server.ts",
      files,
      "STDERR:\nsrc/server.ts(10,3): error TS2322"
    );

    expect(selected).toContain("src/server.ts");
    expect(selected).toContain("package.json");
    expect(selected).toContain("tsconfig.json");
  });

  it("keeps backend prompts focused on server/api files", () => {
    const selected = selectContextFiles("crie uma API de login no backend express", files);

    expect(selected).toContain("src/server.ts");
    expect(selected).toContain("src/app/web/server.ts");
  });
});
