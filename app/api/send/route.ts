import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
}

export async function POST(request: Request) {
  if (!resend) {
    return NextResponse.json({ error: "Resend not configured. Add RESEND_API_KEY to Vercel environment variables." }, { status: 500 });
  }

  try {
    const { to, subject, body, htmlBody }: SendEmailRequest = await request.json();

    const html = htmlBody || `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333333; white-space: pre-wrap;">${body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;

    const { data, error } = await resend.emails.send({
      from: "Abdul-Samad Olagunju <aolagunju@cresa.com>",
      to: [to],
      subject,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
