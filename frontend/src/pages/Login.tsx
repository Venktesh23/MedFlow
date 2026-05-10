// Authentication page for doctor sign-in and registration flows.
import axios from "axios";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

type LoginLocationState = { from?: string };

/** Only allow in-app relative paths (avoid open redirects). */
function safeReturnPath(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return "/";
  if (t.startsWith("/login")) return "/";
  return t;
}

function authErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { error?: { message?: string } })?.error?.message;
    if (msg?.trim()) return msg.trim();
    if (!err.response) return "Network error. Check your connection and try again.";
  }
  return "Unable to authenticate. Check your details and try again.";
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    clinicName: "",
    specialty: "",
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await authenticate();
  }

  async function authenticate() {
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
      const state = location.state as LoginLocationState | null;
      navigate(safeReturnPath(state?.from), { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6 pt-6 pb-14 md:pb-16 font-['Inter',_sans-serif]">
      <form
        onSubmit={submit}
        className="w-full max-w-[440px] bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-6"
      >
        <h1 className="text-[#1A1A2E] text-2xl font-bold">MedFlow</h1>
        <p className="text-[#6B7280] mt-1 mb-6">
          {mode === "login" ? "Sign in to continue." : "Create your doctor account."}
        </p>

        <div className="space-y-4">
          {mode === "register" && (
            <>
              <label className="text-sm text-[#6B7280] block">
                Doctor name *
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-4 py-3 outline-none focus:border-[#047857]"
                />
              </label>
              <label className="text-sm text-[#6B7280] block">
                Clinic name
                <input
                  value={form.clinicName}
                  onChange={(event) => setForm({ ...form, clinicName: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-4 py-3 outline-none focus:border-[#047857]"
                />
              </label>
              <label className="text-sm text-[#6B7280] block">
                Specialty
                <input
                  value={form.specialty}
                  onChange={(event) => setForm({ ...form, specialty: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-4 py-3 outline-none focus:border-[#047857]"
                />
              </label>
            </>
          )}
          <label className="text-sm text-[#6B7280] block">
            Email *
            <input
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              type="email"
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-4 py-3 outline-none focus:border-[#047857]"
            />
          </label>
          <label className="text-sm text-[#6B7280] block">
            Password *
            <input
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              type="password"
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-4 py-3 outline-none focus:border-[#047857]"
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
        {error && (
          <button
            type="button"
            onClick={() => void authenticate()}
            className="mt-2 text-sm text-[#065f46] hover:underline"
          >
            Retry
          </button>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 medflow-primary-button rounded-lg py-3 font-semibold disabled:opacity-60"
        >
          {loading ? "Working..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
          className="w-full mt-4 text-[#065f46] text-sm font-medium hover:underline"
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
