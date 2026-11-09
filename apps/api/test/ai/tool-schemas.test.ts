import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TOOLS } from "../../src/ai/toolRegistry.js";

/**
 * Each tool's JSON Schema (what Claude sees) is hand-written next to its zod
 * schema (what the server enforces). These checks keep the two in step.
 */
describe("tool schemas", () => {
  it("has unique, API-valid tool names", () => {
    const names = TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
  });

  describe.each(TOOLS.map((tool) => [tool.name, tool] as const))("%s", (_name, tool) => {
    const shape = (tool.schema as unknown as z.AnyZodObject).shape as Record<string, z.ZodTypeAny>;

    it("is a zod object", () => {
      expect(tool.schema).toBeInstanceOf(z.ZodObject);
    });

    it("lists the same properties in JSON Schema and zod", () => {
      const jsonKeys = Object.keys(tool.inputSchema.properties ?? {}).sort();
      expect(jsonKeys).toEqual(Object.keys(shape).sort());
    });

    it("marks the same fields required", () => {
      const zodRequired = Object.entries(shape)
        .filter(([, field]) => !field.isOptional())
        .map(([key]) => key)
        .sort();
      const jsonRequired = [...((tool.inputSchema.required as string[] | undefined) ?? [])].sort();
      expect(jsonRequired).toEqual(zodRequired);
    });

    it("rejects unknown properties in JSON Schema", () => {
      expect(tool.inputSchema.additionalProperties).toBe(false);
    });

    it("has a description", () => {
      expect(tool.description.length).toBeGreaterThan(40);
    });
  });
});
