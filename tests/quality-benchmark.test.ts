import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

type CoderSmokeCase = {
  id: string;
  category: string;
  mode: string;
  task: string;
  expected_checks: string[];
};

const REQUIRED_CATEGORIES = [
  "repo_index",
  "multi_file",
  "bugfix",
  "test_creation",
  "docs",
  "refactor",
  "security",
  "rollback",
  "human_approval",
  "ui_autonomy_flow",
  "api_endpoint",
  "persistence",
  "operational_hardening"
];

describe("coder_smoke_100 benchmark fixture", () => {
  async function loadCases() {
    const raw = await readFile(path.join(process.cwd(), "benchmarks", "coder_smoke_100.json"), "utf-8");
    return JSON.parse(raw) as CoderSmokeCase[];
  }

  it("contains exactly 100 unique benchmark cases", async () => {
    const cases = await loadCases();
    const ids = new Set(cases.map((item) => item.id));

    expect(cases).toHaveLength(100);
    expect(ids.size).toBe(100);
    expect(cases[0].id).toBe("coder_001");
    expect(cases.at(-1)?.id).toBe("coder_100");
  });

  it("covers required v0.4 quality categories", async () => {
    const cases = await loadCases();
    const categories = new Set(cases.map((item) => item.category));

    for (const category of REQUIRED_CATEGORIES) {
      expect(categories.has(category), `missing ${category}`).toBe(true);
    }
  });

  it("keeps each case measurable without training or auto-apply work", async () => {
    const cases = await loadCases();
    for (const item of cases) {
      expect(item.task.trim().length).toBeGreaterThan(20);
      expect(item.expected_checks.length).toBeGreaterThan(0);
      expect(item.mode).not.toBe("train");
    }
  });
});
