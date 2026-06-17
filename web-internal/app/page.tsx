"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Index() {
  const { ready, session } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace("/masuk");
    else router.replace(session.role === "owner" ? "/owner" : "/agen");
  }, [ready, session, router]);

  return (
    <div className="min-h-screen grid place-items-center bg-stage">
      <div className="h-8 w-8 rounded-full border-2 border-azure border-t-transparent animate-spin" />
    </div>
  );
}
