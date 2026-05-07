const ATTIO_API_KEY = process.env.ATTIO_API_KEY!;
const ATTIO_PROSPECT_LIST_ID = process.env.ATTIO_PROSPECT_LIST_ID!;
const ATTIO_BASE = "https://api.attio.com/v2";

// ─────────────────────────────────────────────────────────────────────────────
// CORE FETCH
// ─────────────────────────────────────────────────────────────────────────────

export async function attioFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${ATTIO_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${ATTIO_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Attio ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface AttioListEntry {
  id: { entry_id: string };
  parent_record_id: string;
  entry_values: Record<string, AttioValue[]>;
}

interface AttioValue {
  value: unknown;
  active_from?: string;
}

interface AttioPerson {
  name?: Array<{ first_name?: string; last_name?: string }>;
  email_addresses?: Array<{ email_address: string }>;
  job_title?: Array<{ value: string }>;
  phone_numbers?: Array<{ phone_number: string }>;
  primary_location?: Array<{ locality: string }>;
  company?: Array<{ target_record_id: string }>;
}

interface AttioCompany {
  name?: Array<{ value: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get prospects who have the Email_Campaign checkbox checked in Attio.
 * These are the people queued for the email campaign.
 * After sending, mark them via markEmailSent() to update the Email checkbox.
 */
export async function getEmailCampaignProspects(limit = 100): Promise<ColdOutreachProspect[]> {
  const entriesData = await attioFetch<{ data: AttioListEntry[] }>(
    `/lists/${ATTIO_PROSPECT_LIST_ID}/entries/query`,
    {
      method: "POST",
      body: JSON.stringify({
        filter: {
          $and: [
            // Email_Campaign checkbox = checked (list attribute, filter directly)
            { email_campaign: { value: { $eq: true } } },
          ],
        },
        limit,
      }),
    },
  );

  const entries: AttioListEntry[] = entriesData.data || [];

  const results = await Promise.all(
    entries.map(async (e) => {
      const rid = e.parent_record_id;
      try {
        const person = await getPerson(rid);
        const email = person.email_addresses?.[0]?.email_address || "";
        if (!email) return null;
        const company = person.company?.[0]
          ? await getCompany(person.company[0].target_record_id)
          : null;
        const name = person.name?.[0];
        return {
          recordId: rid,
          name: `${name?.first_name || ""} ${name?.last_name || ""}`.trim(),
          email,
          title: person.job_title?.[0]?.value || "",
          companyName: company?.name?.[0]?.value || "",
          phone: person.phone_numbers?.[0]?.phone_number || "",
          location: person.primary_location?.[0]?.locality || "",
          entryId: e.id.entry_id,
          calledToday: false,
          hasVm: false,
        };
      } catch {
        return null;
      }
    }),
  );

  return results.filter(r => r !== null) as ColdOutreachProspect[];
}

/**
 * Mark the Email checkbox on a list entry after an email is sent.
 * This prevents duplicate sends.
 */
export async function markEmailSent(entryId: string) {
  return attioFetch(`/lists/${ATTIO_PROSPECT_LIST_ID}/entries/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: { entry_values: { email: [{ value: true }] } },
    }),
  });
}

// ─── Internal helpers ────────────────────────────────────────────────────────────

export async function getWorkspaceSlug(): Promise<string | null> {
  // Env var takes priority — set ATTIO_WORKSPACE_SLUG in Vercel if the API call fails
  if (process.env.ATTIO_WORKSPACE_SLUG) return process.env.ATTIO_WORKSPACE_SLUG;
  try {
    const data = await attioFetch<{ data: Record<string, unknown> }>("/self");
    console.log("[attio] /self response:", JSON.stringify(data?.data));
    const slug =
      (data?.data?.workspace_slug as string) ||
      (data?.data?.workspace?.slug as string) ||
      null;
    return slug;
  } catch (err) {
    console.error("[attio] getWorkspaceSlug failed:", err);
    return null;
  }
}

export async function getPerson(recordId: string): Promise<AttioPerson> {
  const data = await attioFetch<{ data: { values: AttioPerson } }>(
    `/objects/people/records/${recordId}`,
  );
  return data.data?.values || {};
}

async function getCompany(recordId: string): Promise<AttioCompany | null> {
  try {
    const data = await attioFetch<{ data: { values: AttioCompany } }>(
      `/objects/companies/records/${recordId}`,
    );
    return data.data?.values || null;
  } catch {
    return null;
  }
}

// ─── Shared types ──────────────────────────────────────────────────────────────

export type { AttioListEntry, AttioValue, AttioPerson, AttioCompany };

// ─────────────────────────────────────────────────────────────────────────────
// COLD OUTREACH QUERY — prospects who are:
//   - Status = "Prospect" (not Lead, not Dead, not Customer)
//   - Outreach checkbox = unchecked
//   - Email checkbox = unchecked
// ─────────────────────────────────────────────────────────────────────────────

interface ColdOutreachProspect {
  recordId: string;
  name: string;
  email: string;
  title: string;
  companyName: string;
  phone: string;
  location: string;
  entryId: string;
  calledToday: boolean;
  hasVm: boolean;
}

interface UncontactedProspect extends ColdOutreachProspect {}

export async function getColdOutreachProspects(limit = 50): Promise<ColdOutreachProspect[]> {
  const entriesData = await attioFetch<{ data: AttioListEntry[] }>(
    `/lists/${ATTIO_PROSPECT_LIST_ID}/entries/query`,
    {
      method: "POST",
      body: JSON.stringify({
        filter: {
          $and: [
            // Status = "Prospect"
            { act_status: { $eq: "Prospect" } },
            // Outreach checkbox NOT checked
            { $not: { called_today: { value: { $eq: true } } } },
            // Email checkbox NOT checked
            { $not: { email: { value: { $eq: true } } } },
          ],
        },
        limit: 100,
      }),
    },
  );

  const entries: AttioListEntry[] = entriesData.data || [];

  const results = await Promise.all(
    entries.map(async (e) => {
      const rid = e.parent_record_id;
      try {
        const person = await getPerson(rid);
        const email = person.email_addresses?.[0]?.email_address || "";
        if (!email) return null;
        const company = person.company?.[0]
          ? await getCompany(person.company[0].target_record_id)
          : null;
        const name = person.name?.[0];
        return {
          recordId: rid,
          name: `${name?.first_name || ""} ${name?.last_name || ""}`.trim(),
          email,
          title: person.job_title?.[0]?.value || "",
          companyName: company?.name?.[0]?.value || "",
          phone: person.phone_numbers?.[0]?.phone_number || "",
          location: person.primary_location?.[0]?.locality || "",
          entryId: e.id.entry_id,
        };
      } catch {
        return null;
      }
    }),
  );

  return results.filter((r): r is ColdOutreachProspect => r !== null).slice(0, limit);
}
