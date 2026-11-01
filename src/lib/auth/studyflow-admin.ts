import "server-only";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";

export function isStudyFlowAdmin(email: string | null) {
  if (!email) return false;

  const allowedEmails = (process.env.STUDYFLOW_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowedEmails.includes(email.trim().toLowerCase());
}

export async function requireStudyFlowAdmin() {
  const user = await requireUser();
  if (!isStudyFlowAdmin(user.email)) redirect("/dashboard");
  return user;
}
