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

// Seed categories — users can add their own via the template editor
export const DEFAULT_CATEGORIES = [
  "cold-outreach",
  "sublease",
  "investment-sales",
  "landlord-outreach",
  "renewals",
];

export function formatCategory(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

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

