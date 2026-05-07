import { NextRequest, NextResponse } from "next/server";
import { getEmailCampaignProspects } from "@/lib/attio";

// Dashboard expects /api/attio/contacts?limit=N
// Response: { contacts: AttioContact[], count: number }
// AttioContact: { record_id, name, email, company, job_title, web_url }

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
    const prospects = await getEmailCampaignProspects(limit);

    const contacts: AttioContact[] = prospects.map((p) => ({
      record_id: p.recordId,
      name: p.name,
      email: p.email,
      company: p.companyName,
      job_title: p.title,
      web_url: "", // Attio people don't have a web_url field
    }));

    return NextResponse.json({ contacts, count: contacts.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}