import { NextRequest, NextResponse } from "next/server";
import { getEmailCampaignProspects, getWorkspaceSlug } from "@/lib/attio";

interface AttioContact {
  record_id: string;
  name: string;
  email: string;
  company: string;
  job_title: string;
  web_url: string;
}

export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get("limit") || "10");
    const [prospects, workspaceSlug] = await Promise.all([
      getEmailCampaignProspects(limit),
      getWorkspaceSlug(),
    ]);

    const contacts: AttioContact[] = prospects.map((p) => ({
      record_id: p.recordId,
      name: p.name,
      email: p.email,
      company: p.companyName,
      job_title: p.title,
      web_url: workspaceSlug
        ? `https://app.attio.com/${workspaceSlug}/people/${p.recordId}`
        : "",
    }));

    return NextResponse.json({ contacts, count: contacts.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}