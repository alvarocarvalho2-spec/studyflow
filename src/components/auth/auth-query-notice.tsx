"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ConfirmationNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get("status") !== "confirmation-failed") return null;

  return (
    <p className="auth-message error-message" role="alert">
      Este link de confirmação não é mais válido. Tente criar a conta novamente ou entre se já confirmou o e-mail.
    </p>
  );
}

export function AuthQueryNotice() {
  return <Suspense fallback={null}><ConfirmationNotice /></Suspense>;
}
