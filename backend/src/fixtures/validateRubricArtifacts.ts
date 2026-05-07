import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const ROOT = resolve(import.meta.dirname, "../../..");

const JsonSchemaLike = z.object({
  $schema: z.string().optional(),
  type: z.union([z.string(), z.array(z.string())]).optional()
}).passthrough();

const ToolContract = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  input_schema: JsonSchemaLike,
  output_schema: JsonSchemaLike
});

function loadText(path: string) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function hasAllNeedles(text: string, needles: string[]) {
  return needles.every((needle) => text.includes(needle));
}

const prompt = loadText("system_prompt.txt");
const rawTools = JSON.parse(loadText("tools.json")) as unknown;
const tools = z.array(ToolContract).parse(rawTools);

const validToolCount = tools.filter((tool) => tool.input_schema && tool.output_schema).length;
const checks = [
  {
    name: "system_prompt_specific",
    passed: prompt.length > 200 && hasAllNeedles(prompt, ["CMF", "SII", "Ley 21.719"]),
    details: {
      chars: prompt.length,
      hasCMF: prompt.includes("CMF"),
      hasSII: prompt.includes("SII"),
      hasLey21719: prompt.includes("Ley 21.719")
    }
  },
  {
    name: "tools_json_contracts",
    passed: validToolCount >= 2,
    details: {
      toolCount: tools.length,
      validToolCount,
      tools: tools.map((tool) => tool.name)
    }
  }
];

const result = {
  ok: checks.every((check) => check.passed),
  checkedAt: new Date().toISOString(),
  checks
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}
