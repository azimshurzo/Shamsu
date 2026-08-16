"use client";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";

export default function UserDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role === "ADMIN") router.push("/admin");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="animate-pulse-neon gradient-neon-text text-2xl font-bold">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== "USER") return null;

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
