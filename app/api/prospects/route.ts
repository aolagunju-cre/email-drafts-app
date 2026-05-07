import { NextRequest, NextResponse } from "next/server";
import { getEmailCampaignProspects } from "@/lib/attio";

export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get("limit") || "10");
    const prospects = await getEmailCampaignProspects(limit);
    return NextResponse.json({ prospects });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}