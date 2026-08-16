"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push(user.role === "ADMIN" ? "/admin" : "/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="animate-pulse-neon gradient-neon-text text-4xl font-bold">
          SHAMSU
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-glow">
        <div className="text-2xl font-bold gradient-neon-text">SHAMSU</div>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-lg border border-[rgba(0,212,255,0.3)] text-[#00d4ff] hover:bg-[rgba(0,212,255,0.08)] transition-all text-sm font-medium"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-lg gradient-neon text-[#0a0a0f] font-semibold hover:opacity-90 transition-all text-sm"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="max-w-3xl animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="gradient-neon-text">No-Code</span> API Creation Platform
          </h1>
          <p className="text-lg text-[#64748b] mb-10 max-w-xl mx-auto leading-relaxed">
            Record workflows on any website, extract data patterns, and generate
            reusable APIs — all without writing a single line of code.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-3.5 rounded-lg gradient-neon text-[#0a0a0f] font-bold text-base glow-cyan hover:scale-[1.02] transition-all"
            >
              Start Building APIs
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 rounded-lg border border-[rgba(0,212,255,0.3)] text-[#00d4ff] font-medium text-base hover:bg-[rgba(0,212,255,0.08)] transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full px-4">
          {[
            { title: "Record", desc: "Click through any website workflow naturally", icon: "◉" },
            { title: "Extract", desc: "Identify data patterns across entire pages", icon: "⬡" },
            { title: "Execute", desc: "Run APIs with visual browser automation", icon: "▶" },
          ].map((item) => (
            <div key={item.title} className="card-neon p-6 text-left">
              <div className="text-[#00d4ff] text-2xl mb-3">{item.icon}</div>
              <h3 className="text-white font-semibold mb-2">{item.title}</h3>
              <p className="text-[#64748b] text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-8 py-6 border-t border-glow text-center text-[#64748b] text-xs">
        Shamsu.com — Local MVP
      </footer>
    </div>
  );
}
