import { NextResponse } from "next/server";
import { getColdOutreachProspects } from "@/lib/attio";

export async function GET() {
  try {
    const prospects = await getColdOutreachProspects();
    return NextResponse.json({ prospects });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
