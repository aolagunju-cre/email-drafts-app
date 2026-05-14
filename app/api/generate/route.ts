import { NextResponse } from "next/server";
import { renderTemplate } from "@/lib/templates";

interface Contact {
  name: string;
  email: string;
  company: string;
  job_title?: string;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

// Default template used when no template is selected
function buildDefaultDraft(name: string, email: string, company: string) {
  return {
    to: email,
    subject: `Supporting ${company} from Cresa`,
    body: `Hi ${firstName(name)},

Not sure if you'd be the right person to connect with on this, but this typically falls under whoever oversees office or real estate decisions internally.

My team advises companies such as Whitecap Resources, BDP, and United Way on office lease strategy, renewals, expansions, and cost reduction initiatives. We're currently working with a client that has an additional 3,500 SF available at 1305 11 Avenue SW that could potentially align with your team's needs while creating an opportunity for meaningful cost savings, so I wanted to see if there may be any interest on your end.

If your team expects to evaluate office space over the next 12 to 24 months, I'd be happy to share other relevant market insights and opportunities that may be of interest.

If you'd prefer not to receive these emails, just let me know.

Best,`,
  };
}

export async function POST(request: Request) {
  const payload = await request.json();

  const hasTemplate = typeof payload.subject === "string" && typeof payload.body === "string";
  const extraVars: Record<string, string> = payload.extraVars || {};

  // Auto-generate path: contacts array from the dashboard
  if (Array.isArray(payload.contacts) && payload.contacts.length > 0) {
    const drafts = (payload.contacts as Contact[]).map((c) => {
      const vars = { first_name: firstName(c.name), company: c.company, ...extraVars };
      if (hasTemplate) {
        return {
          to: c.email,
          subject: renderTemplate(payload.subject, vars),
          body: renderTemplate(payload.body, vars),
        };
      }
      return buildDefaultDraft(c.name, c.email, c.company);
    });
    return NextResponse.json({ drafts });
  }

  // Manual-generate path: individual scalar fields
  const { prospectName = "", prospectEmail = "", prospectCompany = "" } = payload;
  const vars = { first_name: firstName(prospectName), company: prospectCompany, ...extraVars };
  const draft = hasTemplate
    ? {
        to: prospectEmail,
        subject: renderTemplate(payload.subject, vars),
        body: renderTemplate(payload.body, vars),
      }
    : buildDefaultDraft(prospectName, prospectEmail, prospectCompany);

  return NextResponse.json({ drafts: [draft] });
}
