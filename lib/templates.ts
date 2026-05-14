import fs from "fs";
import path from "path";

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  subject: string;
  variables: string[];
  body: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export const CATEGORIES = [
  "cold-outreach",
  "sublease",
  "investment-sales",
  "landlord-outreach",
  "renewals",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Variables auto-filled from Attio contact data — not shown as user inputs
export const CONTACT_VARS = new Set(["first_name", "company"]);

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function extractVariables(text: string): string[] {
  const matches = [...text.matchAll(/\{(\w+)\}/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateTemplate(t: Partial<Template>): string | null {
  if (!t.id || !/^[a-z0-9-]+$/.test(t.id))
    return "id must be lowercase letters, numbers, and hyphens only";
  if (!t.name?.trim()) return "name is required";
  if (!t.subject?.trim()) return "subject is required";
  if (!t.body?.trim()) return "body is required";
  if (!t.category) return "category is required";
  return null;
}

// Read templates from the filesystem (deployed bundle — fast, no API latency)
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
