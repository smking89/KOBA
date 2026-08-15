import { getPublicEnv } from "@/lib/env";
import { prisma } from "@/lib/db";

type MailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

async function deliver(payload: MailPayload): Promise<void> {
  const { nodeEnv } = getPublicEnv();
  if (isEmailConfigured()) {
    const apiKey = process.env.RESEND_API_KEY!.trim();
    const from = process.env.EMAIL_FROM!.trim();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Resend send failed (${response.status}): ${body.slice(0, 200)}`);
    }
    return;
  }

  if (nodeEnv === "production") {
    return;
  }
  console.info(`[KOBA] Dev mail → ${payload.to}: ${payload.subject}\n${payload.text}`);
}

export async function notifyPlusPaymentFailed(userId: string, publicRef: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) return;

  const { appUrl } = getPublicEnv();
  const manageUrl = `${appUrl}/plus`;
  await deliver({
    to: user.email,
    subject: "KOBA Plus payment failed",
    text: `Your KOBA Plus payment could not be completed (ref ${publicRef}). Manage billing: ${manageUrl}`,
    html: `<p>Your KOBA Plus payment could not be completed (ref ${publicRef}).</p><p><a href="${manageUrl}">Manage billing</a></p>`,
  });
}
