"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { SpinnerIcon } from "@/components/icons";

export default function Index() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? "/beranda" : "/masuk");
  }, [ready, user, router]);

  return (
    <div className="min-h-screen grid place-items-center text-azure">
      <SpinnerIcon size={32} />
    </div>
  );
}
