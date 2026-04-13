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

  const subject = `Pleasure to Connect & Office Opportunity`;

  const body = `Hi ${firstName},

Hope you're doing well. Not sure if you're the right person at ${company || "your company"} to talk to about office space here in Calgary, but thought I would reach out.

My name is Abdul-Samad Olagunju, and I'm a corporate real estate advisor at Cresa focused on helping tenants reduce costs and find the right fit in terms of their space. We recently helped a different firm save 10% on their lease costs by proactively looking at options in the market, so I thought it might be useful to share this opportunity with your team.

${additionalContext ? additionalContext + "\n\n" : ""}${propertyInterest ? propertyInterest + "\n\n" : ""}If this isn't a fit, feel free to share your criteria such as size, budget, location, and timing, and I can keep an eye out for opportunities that align. And if you'd prefer not to receive these, just let me know.

Best,`;

  return { subject, body };
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