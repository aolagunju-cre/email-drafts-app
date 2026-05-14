import { NextResponse } from "next/server";
import { validateTemplate, extractVariables, slugify, type Template } from "@/lib/templates";
import { readTemplatesFromDisk } from "@/lib/templates-server";
import { writeGHFile } from "@/lib/github-files";

export async function GET() {
  try {
    const templates = readTemplatesFromDisk();
    return NextResponse.json({ templates });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const id = body.id || slugify(body.name || "");
    const template: Template = {
      id,
      name: body.name || "",
      category: body.category || "",
      description: body.description || "",
      subject: body.subject || "",
      body: body.body || "",
      variables: extractVariables((body.subject || "") + " " + (body.body || "")),
      archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const error = validateTemplate(template);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const filePath = `templates/${template.category}/${template.id}.json`;
    await writeGHFile(
      filePath,
      JSON.stringify(template, null, 2),
      `feat: add template "${template.name}"`,
    );

    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
