import { NextResponse } from "next/server";

interface ProspectDraftRequest {
  prospectName?: string;
  prospectCompany?: string;
  propertyInterest?: string;
  additionalContext?: string;
}

interface BatchDraftRequest {
  contacts: Array<{
    name: string;
    email: string;
    company: string;
    job_title: string;
  }>;
  propertyInterest?: string;
  additionalContext?: string;
}

function generateDraftEmail(
  name: string,
  company: string,
  propertyInterest: string,
  additionalContext: string
) {
  const firstName = name.split(" ")[0] || name;
  const personalization = company
    ? `I noticed ${company} is looking at ${propertyInterest || "office space in Calgary"}.`
    : `I came across your profile and think you might benefit from what we're building at Cresa.`;

  const subjectLines = [
    `${company ? company + " — " : ""}Quick question about your office space needs`,
    `${propertyInterest || "Calgary office space"} — fitting your timeline?`,
    `${firstName}, one thing about Calgary commercial real estate`,
  ];

  const bodies = [
    `Hi ${firstName},

${personalization}

I've been helping companies like yours find the right office space in Calgary — typically saving them 15-20% on lease costs while finding better locations than they expected.

${additionalContext ? additionalContext + "\n\n" : ""}Would it make sense to grab a 15-minute call this week to see if there's a fit?

Best,
Abdul-Samad
Cresa`,
    `Hey ${firstName},

${personalization}

Rather than doing a cold outreach, I wanted to offer something useful: a free market snapshot of what's available in ${propertyInterest || "Calgary's commercial market"} right now — no commitment required.

${additionalContext ? additionalContext + "\n\n" : ""}Worth a quick conversation to see if it sparks any ideas?

Abdul-Samad
Cresa`,
  ];

  const subject = subjectLines[Math.floor(Math.random() * subjectLines.length)];
  const emailBody = bodies[Math.floor(Math.random() * bodies.length)];

  return { subject, body: emailBody };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as ProspectDraftRequest | BatchDraftRequest;

    // Batch generate from contacts
    if ("contacts" in body && body.contacts && body.contacts.length > 0) {
      const batchBody = body as BatchDraftRequest;
      const drafts = batchBody.contacts.map((contact) => {
        const { subject, body: emailBody } = generateDraftEmail(
          contact.name,
          contact.company,
          batchBody.propertyInterest || "",
          batchBody.additionalContext || ""
        );
        return {
          to: contact.email,
          subject,
          body: emailBody,
        };
      });

      return NextResponse.json({ drafts, count: drafts.length });
    }

    // Single prospect generate
    const prospectBody = body as ProspectDraftRequest;
    if (!prospectBody.prospectName) {
      return NextResponse.json(
        { error: "prospectName is required" },
        { status: 400 }
      );
    }

    const { subject, body: emailBody } = generateDraftEmail(
      prospectBody.prospectName,
      prospectBody.prospectCompany || "",
      prospectBody.propertyInterest || "",
      prospectBody.additionalContext || ""
    );

    const draft = {
      to: `${prospectBody.prospectName.toLowerCase().replace(/\s+/g, ".")}@${(prospectBody.prospectCompany || "company").toLowerCase().replace(/\s+/g, "")}.com`,
      subject,
      body: emailBody,
    };

    return NextResponse.json({ drafts: [draft], count: 1 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
