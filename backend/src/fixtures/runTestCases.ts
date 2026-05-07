import { testCases } from "./testCases.js";
import { analyzeMessage } from "../services/orchestrator.js";

for (const item of testCases) {
  const result = await analyzeMessage(item);
  console.log(JSON.stringify({ subject: item.subject ?? item.sender, result }, null, 2));
}

