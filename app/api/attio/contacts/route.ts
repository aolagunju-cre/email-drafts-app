import { NextResponse } from "next/server";
import { getTodaysContacts } from "@/lib/attio";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  if (!process.env.ATTIO_API_KEY) {
    return NextResponse.json({ error: "Attio API key not configured" }, { status: 500 });
  }

  try {
    const contacts = await getTodaysContacts(limit);
    return NextResponse.json({ contacts, count: contacts.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch contacts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
