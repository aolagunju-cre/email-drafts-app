import { NextResponse } from "next/server";
import { getUndraftedContacts } from "@/lib/attio";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const debug = searchParams.get("debug") === "true";

  if (!process.env.ATTIO_API_KEY) {
    return NextResponse.json({ error: "Attio API key not configured" }, { status: 500 });
  }

  // Debug endpoint — trace exactly what getUndraftedContacts does
  if (debug) {
    const ATTIO_API_KEY = process.env.ATTIO_API_KEY!;
    const PROSPECT_LIST_ID = "94f88d4f-4334-49a6-b514-a2ec366898ee";
    const ATTIO_BASE = "https://api.attio.com/v2";

    try {
      // Step 1: Query call_list entries
      const entriesRes = await fetch(`${ATTIO_BASE}/lists/call_list/entries/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ATTIO_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filter: { call: false, voicemail: false, booked_meeting: false, email: false }, limit: 20 }),
      });
      const entriesData = await entriesRes.json();
      const entries: any[] = entriesData.data || [];

      const debugInfo: any = {
        step1_entriesCount: entries.length,
        step1_entries: entries.map((e: any) => ({
          entry_id: e.id?.entry_id,
          parent_record_id: e.parent_record_id,
          email_value: JSON.stringify(e.entry_values?.email),
          call_value: JSON.stringify(e.entry_values?.call),
        })),
      };

      const recordIds = entries.map((e: any) => e.parent_record_id);

      // Step 2: Batch fetch people
      const peopleRes = await fetch(`${ATTIO_BASE}/objects/people/records/query?limit=${recordIds.length}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ATTIO_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          object: "person",
          filters: [{ attribute: "record_id", filter: { type: "any", value: recordIds } }],
          sort: [],
          limit: recordIds.length,
        }),
      });
      const peopleData = await peopleRes.json();
      const people: any[] = peopleData.data || [];

      debugInfo.step2_peopleCount = people.length;
      debugInfo.step2_people = people.map((p: any) => ({
        record_id: p.id?.record_id,
        name: p.values?.name?.[0]?.full_name || "",
        email: p.values?.email_addresses?.[0]?.email_address || "",
      }));

      return NextResponse.json({ debug: debugInfo });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[debug] Error:", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  try {
    const contacts = await getUndraftedContacts(limit);
    return NextResponse.json({ contacts, count: contacts.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch contacts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
