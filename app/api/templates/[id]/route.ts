import { NextRequest, NextResponse } from "next/server";
import { validateTemplate, extractVariables, type Template } from "@/lib/templates";
import { readTemplatesFromDisk } from "@/lib/templates-server";
import { readGHFile, writeGHFile } from "@/lib/github-files";

async function findTemplate(id: string): Promise<{ template: Template; ghPath: string; sha: string } | null> {
  // Find via disk first (fast), then fetch the sha from GitHub for writing
  const all = readTemplatesFromDisk();
  const found = all.find((t) => t.id === id);
  if (!found) return null;

  const ghPath = `templates/${found.category}/${found.id}.json`;
  try {
    const { sha } = await readGHFile(ghPath);
    return { template: found, ghPath, sha };
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const found = await findTemplate(params.id);
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updates = await req.json();
    const merged: Template = {
      ...found.template,
      ...updates,
      id: found.template.id, // id is immutable
      variables: extractVariables(
        (updates.subject ?? found.template.subject) + " " + (updates.body ?? found.template.body),
      ),
      updated_at: new Date().toISOString(),
    };

    const error = validateTemplate(merged);
    if (error) return NextResponse.json({ error }, { status: 400 });

    await writeGHFile(
      found.ghPath,
      JSON.stringify(merged, null, 2),
      `feat: update template "${merged.name}"`,
      found.sha,
    );

    return NextResponse.json({ template: merged });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const found = await findTemplate(params.id);
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const archived: Template = {
      ...found.template,
      archived: true,
      updated_at: new Date().toISOString(),
    };

    await writeGHFile(
      found.ghPath,
      JSON.stringify(archived, null, 2),
      `chore: archive template "${found.template.name}"`,
      found.sha,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
