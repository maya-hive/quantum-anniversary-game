import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function envCandidates(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(here, "../../../.env"),
  ];
}

const envFile = envCandidates().find((candidate) => existsSync(candidate));

if (envFile && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}
