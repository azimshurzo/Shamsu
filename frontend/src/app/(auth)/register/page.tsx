"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const nameValid = name.length >= 2 && name.length <= 50;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passValid = password.length >= 6;
  const formValid = nameValid && emailValid && passValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) return;
    setLoading(true);
    try {
      const user = await register(name, email, password);
      toast.success("Account created!");
      router.push(user.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold gradient-neon-text">SHAMSU</Link>
          <p className="text-[#64748b] mt-2 text-sm">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="card-neon p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={50}
              className="w-full px-4 py-3 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] transition-all"
              placeholder="Your name"
            />
            {name.length > 0 && !nameValid && (
              <p className="text-xs text-[#ff3366] mt-1">2-50 characters required</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] transition-all"
              placeholder="you@example.com"
            />
            {email.length > 0 && !emailValid && (
              <p className="text-xs text-[#ff3366] mt-1">Enter a valid email</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-[#0a0a0f] border border-[rgba(0,212,255,0.12)] rounded-lg text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#00d4ff] focus:ring-1 focus:ring-[#00d4ff] transition-all"
              placeholder="Min 6 characters"
            />
            {password.length > 0 && !passValid && (
              <p className="text-xs text-[#ff3366] mt-1">Minimum 6 characters</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !formValid}
            className="w-full py-3 rounded-lg gradient-neon text-[#0a0a0f] font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-center text-sm text-[#64748b]">
            Already have an account?{" "}
            <Link href="/login" className="text-[#00d4ff] hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
