import { NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY!;

export async function POST(request: Request) {
  const { prospectName, prospectCompany, propertyInterest, additionalContext } = await request.json();

  const prompt = `You are a Calgary commercial real estate broker writing a cold email to a prospective tenant.

Prospect: ${prospectName} at ${prospectCompany}.
${propertyInterest ? `Property interest: ${propertyInterest}` : ""}
${additionalContext ? `Additional context: ${additionalContext}` : ""}

Write a short, personable cold email (under 150 words). No generic openers. Reference the prospect's company specifically if possible. End with a clear next step. No bullet points. Plain text only.`;

  // Generate with AI...
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
    body = `Hi ${prospectName},\n\nI came across ${prospectCompany} and thought of reaching out directly. We're working with a few landlords in Calgary who have compelling office opportunities that could be a strong fit.\n\nHappy to share details if you're open to it.\n\nBest,\nAbdul-Samad Olagunju\nCresa Calgary`;
  }

  const subject = `Offices in Calgary — ${prospectCompany}`;

  // Send via Resend
  if (RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Abdul-Samad Olagunju <aolagunju@cresa.com>",
        to: prospectCompany, // placeholder; real send from mailto
        subject,
        text: body,
      }),
    });
  }

  return NextResponse.json({ drafts: [{ to: prospectName, subject, body }] });
}
