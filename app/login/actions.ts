"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function handleLogin(formData: FormData) {
  const password = formData.get("password");

  if (password === process.env.AUTH_PASSWORD) {
    const cookieStore = await cookies();
    cookieStore.set("auth", "ok", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    redirect("/dashboard");
  }

  redirect("/login?error=1");
}
