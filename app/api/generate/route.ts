import { NextResponse } from "next/server";

interface Contact {
  name: string;
  email: string;
  company: string;
  job_title?: string;
}

async function generateDraft(
  name: string,
  email: string,
  company: string,
  propertyInterest: string,
  additionalContext: string,
): Promise<{ to: string; subject: string; body: string }> {
  const prompt = `You are a Calgary commercial real estate broker writing a cold email to a prospective tenant.

Prospect: ${name} at ${company}.
${propertyInterest ? `Property interest: ${propertyInterest}` : ""}
${additionalContext ? `Additional context: ${additionalContext}` : ""}

Write a short, personable cold email (under 150 words). No generic openers. Reference the prospect's company specifically if possible. End with a clear next step. No bullet points. Plain text only.`;

  let body = "";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
      }),
    });
    const data = await res.json();
    body = data.choices?.[0]?.message?.content?.trim() || "";
  } catch {
    body = `Hi ${name},\n\nI came across ${company} and thought of reaching out directly. We're working with a few landlords in Calgary who have compelling office opportunities that could be a strong fit.\n\nHappy to share details if you're open to it.\n\nBest,\nAbdul-Samad Olagunju\nCresa Calgary`;
  }

  return {
    to: email,
    subject: `Offices in Calgary — ${company}`,
    body,
  };
}

export async function POST(request: Request) {
  const payload = await request.json();
  const { propertyInterest = "", additionalContext = "" } = payload;

  // Auto-generate path: contacts array sent by the dashboard
  if (Array.isArray(payload.contacts) && payload.contacts.length > 0) {
    const drafts = await Promise.all(
      (payload.contacts as Contact[]).map((c) =>
        generateDraft(c.name, c.email, c.company, propertyInterest, additionalContext),
      ),
    );
    return NextResponse.json({ drafts });
  }

  // Manual-generate path: individual scalar fields
  const { prospectName = "", prospectEmail = "", prospectCompany = "" } = payload;
  const draft = await generateDraft(
    prospectName,
    prospectEmail,
    prospectCompany,
    propertyInterest,
    additionalContext,
  );
  return NextResponse.json({ drafts: [draft] });
}