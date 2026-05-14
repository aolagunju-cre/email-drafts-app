import fs from "fs";
import path from "path";
import { type Template } from "@/lib/templates";

// Server-only — reads template JSON files from the deployed filesystem
export function readTemplatesFromDisk(): Template[] {
  const templatesDir = path.join(process.cwd(), "templates");
  const templates: Template[] = [];

  if (!fs.existsSync(templatesDir)) return templates;

  for (const category of fs.readdirSync(templatesDir)) {
    const categoryPath = path.join(templatesDir, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;
    for (const file of fs.readdirSync(categoryPath)) {
      if (!file.endsWith(".json")) continue;
      try {
        const content = fs.readFileSync(path.join(categoryPath, file), "utf-8");
        templates.push(JSON.parse(content) as Template);
      } catch {
        // skip malformed files
      }
    }
  }

  return templates;
}
