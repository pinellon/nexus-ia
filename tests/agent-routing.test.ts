import { describe, expect, it } from "vitest";

import {
  extractRequestedFilePath,
  isCodeCreationGoal,
  shouldRequirePlan,
  suggestAgentId
} from "../src/app/agents/routing.js";

describe("agent routing", () => {
  it("routes app/site/component prompts to site_builder_agent", () => {
    expect(suggestAgentId("crie um app de tarefas")).toBe("site_builder_agent");
    expect(suggestAgentId("landing page moderna")).toBe("site_builder_agent");
    expect(suggestAgentId("melhore o componente de login")).toBe("site_builder_agent");
    expect(suggestAgentId("crie uma pagina inicial")).toBe("site_builder_agent");
  });

  it("routes debug separately from creation", () => {
    expect(suggestAgentId("corrija o erro de build")).toBe("debug_agent");
    expect(suggestAgentId("crie um site e corrija o layout")).toBe("site_builder_agent");
  });

  it("detects code creation goals", () => {
    expect(isCodeCreationGoal("crie uma landing page")).toBe(true);
    expect(isCodeCreationGoal("apenas documentacao readme")).toBe(false);
  });

  it("requires plan only for complex scopes", () => {
    expect(shouldRequirePlan("crie uma landing page")).toBe(false);
    expect(shouldRequirePlan("crie um app completo com auth e dashboard")).toBe(true);
  });

  it("extracts file paths from natural language", () => {
    expect(extractRequestedFilePath('crie o arquivo public/landing.html')).toBe("public/landing.html");
    expect(extractRequestedFilePath("atualize src/App.tsx")).toBe("src/App.tsx");
  });
});
