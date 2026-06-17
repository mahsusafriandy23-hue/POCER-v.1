"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { SpinnerIcon } from "./icons";

/** Client-side gate: redirect to /masuk when there's no session. */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/masuk");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="min-h-screen grid place-items-center text-azure">
        <SpinnerIcon size={32} />
      </div>
    );
  }
  return <>{children}</>;
}
