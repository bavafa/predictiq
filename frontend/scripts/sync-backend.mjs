// Copies ../backend/app into ./_backend/app so the Vercel Python function can bundle it.
// backend/ stays the only source; _backend/ is generated and git-ignored.
import { cpSync, rmSync } from "node:fs";

rmSync("_backend", { recursive: true, force: true });
cpSync("../backend/app", "_backend/app", {
  recursive: true,
  filter: (src) => !src.includes("__pycache__"),
});
console.log("synced backend/app -> frontend/_backend/app");
