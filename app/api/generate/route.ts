import { NextResponse } from "next/server";

interface Contact {
  name: string;
  email: string;
  company: string;
  job_title?: string;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function buildDraft(name: string, email: string, company: string) {
  return {
    to: email,
    subject: `Supporting ${company} from Cresa`,
    body: `Hey ${firstName(name)},

Not sure if you'd be the right person to connect with on this, but this typically falls under whoever oversees office or real estate decisions internally.

We currently have a client with an additional 3,500 SF of office space that could present a good opportunity, so I wanted to pass it along to your team.

If it's not relevant, feel free to send over your criteria such as size, budget, location, and timing, and I can keep an eye out for opportunities that align. If you'd prefer not to receive these, just reply 1.

Best,
Abdul-Samad Olagunju
Cresa Calgary`,
  };
}

export async function POST(request: Request) {
  const payload = await request.json();

  // Auto-generate path: contacts array from the dashboard
  if (Array.isArray(payload.contacts) && payload.contacts.length > 0) {
    const drafts = (payload.contacts as Contact[]).map((c) =>
      buildDraft(c.name, c.email, c.company),
    );
    return NextResponse.json({ drafts });
  }

  // Manual-generate path: individual scalar fields
  const { prospectName = "", prospectEmail = "", prospectCompany = "" } = payload;
  return NextResponse.json({ drafts: [buildDraft(prospectName, prospectEmail, prospectCompany)] });
}
