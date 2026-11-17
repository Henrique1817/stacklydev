import { NextResponse } from "next/server";

const STRIPE_API = "https://api.stripe.com/v1";

interface StripeSubscription {
  id: string;
  status: string;
  customer?: string | { email?: string | null };
}

async function stripeGet<T>(path: string, secretKey: string): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Erro ao consultar a Stripe.");
  }
  return data as T;
}

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { valid: false, error: "STRIPE_SECRET_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  let body: { licenseKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, error: "Invalid payload." }, { status: 400 });
  }

  const key = typeof body.licenseKey === "string" ? body.licenseKey.trim() : "";
  if (!key) {
    return NextResponse.json(
      { valid: false, error: "Provide a Stripe subscription ID (sub_...) or email." },
      { status: 400 },
    );
  }

  try {
    let sub: StripeSubscription | null = null;
    let customerEmail: string | null = null;

    if (key.startsWith("sub_")) {
      sub = await stripeGet<StripeSubscription>(
        `/subscriptions/${encodeURIComponent(key)}?expand[]=customer`,
        secretKey,
      );
      if (sub.customer && typeof sub.customer === "object") {
        customerEmail = sub.customer.email ?? null;
      }
    } else if (key.startsWith("cs_")) {
      const session = await stripeGet<{
        subscription?: string | null;
        customer_details?: { email?: string | null };
      }>(`/checkout/sessions/${encodeURIComponent(key)}`, secretKey);
      customerEmail = session.customer_details?.email ?? null;
      if (session.subscription) {
        sub = await stripeGet<StripeSubscription>(
          `/subscriptions/${encodeURIComponent(session.subscription)}`,
          secretKey,
        );
      }
    } else if (key.includes("@")) {
      const customers = await stripeGet<{ data: { id: string; email: string | null }[] }>(
        `/customers?email=${encodeURIComponent(key.toLowerCase())}&limit=3`,
        secretKey,
      );
      for (const c of customers.data) {
        const subs = await stripeGet<{ data: StripeSubscription[] }>(
          `/subscriptions?customer=${encodeURIComponent(c.id)}&status=all&limit=5`,
          secretKey,
        );
        const active = subs.data.find((s) => s.status === "active" || s.status === "trialing");
        if (active) {
          sub = active;
          customerEmail = c.email;
          break;
        }
      }
    } else {
      return NextResponse.json(
        { valid: false, error: "Invalid format. Use sub_..., cs_..., or your checkout email." },
        { status: 400 },
      );
    }

    if (!sub) {
      return NextResponse.json(
        { valid: false, error: "No Stripe subscription found for this key." },
        { status: 404 },
      );
    }

    const valid = sub.status === "active" || sub.status === "trialing";
    if (!valid) {
      return NextResponse.json(
        {
          valid: false,
          status: sub.status,
          error: `Subscription found, but it is inactive (${sub.status}).`,
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      valid: true,
      subscriptionId: sub.id,
      status: sub.status,
      customerEmail,
    });
  } catch (e) {
    return NextResponse.json(
      { valid: false, error: e instanceof Error ? e.message : "Erro ao validar na Stripe." },
      { status: 502 },
    );
  }
}

