import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  let body: { email?: unknown; os?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const os =
    body.os === "windows" || body.os === "macos" ? body.os : "unknown";

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { error: "Waitlist is not configured on the server yet (SUPABASE_URL)." },
      { status: 503 },
    );
  }

  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/waitlist`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ email, os }),
  });

  if (res.status === 409) {
    return NextResponse.json(
      { ok: true, alreadyRegistered: true, message: "This email is already on the waitlist." },
      { status: 200 },
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (text.includes("23505")) {
      return NextResponse.json(
        { ok: true, alreadyRegistered: true, message: "This email is already on the waitlist." },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { error: "Could not save your email right now. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { ok: true, message: "You're on the waitlist! We'll email you at launch." },
    { status: 201 },
  );
}

