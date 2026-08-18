import { existsSync } from "node:fs";
import path from "node:path";

export function workspaceRoot(): string {
  let dir = process.cwd();
  for (let index = 0; index < 8; index += 1) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return process.cwd();
}
