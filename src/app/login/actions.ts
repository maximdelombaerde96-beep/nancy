"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, sessionToken, veiligPad } from "@/lib/auth";

export interface LoginState {
  error?: string;
}

// Controleert het wachtwoord en zet bij succes de sessiecookie.
export async function login(
  _prev: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const password = String(formData.get("password") || "");
  const from = veiligPad(String(formData.get("from") || "/"));

  const expected = process.env.APP_PASSWORD || "";

  // Poortje staat uit -> geen wachtwoord nodig.
  if (!expected) redirect(from);

  if (password !== expected) {
    return { error: "Onjuist wachtwoord. Probeer opnieuw." };
  }

  const token = await sessionToken(expected);
  const jar = await cookies();
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dagen
  });

  redirect(from);
}

// Meldt af: verwijdert de sessiecookie.
export async function logout() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
  redirect("/login");
}
