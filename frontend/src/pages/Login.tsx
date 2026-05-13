import axios from "axios";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LOGO_URL = "/Medflow.png";

type LoginFormState = {
  email: string;
  password: string;
};

type SignUpFormState = {
  name: string;
  email: string;
  password: string;
  clinicName: string;
  specialty: string;
};

const defaultLoginState: LoginFormState = {
  email: "",
  password: "",
};

const defaultSignUpState: SignUpFormState = {
  name: "",
  email: "",
  password: "",
  clinicName: "",
  specialty: "",
};

const Login = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState("login");
  const [loginState, setLoginState] = useState(defaultLoginState);
  const [signUpState, setSignUpState] = useState(defaultSignUpState);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [signUpBusy, setSignUpBusy] = useState(false);

  const subtitle = useMemo(
    () =>
      activeTab === "login"
        ? "Precision care, simplified workflow."
        : "Create your clinic workspace in minutes.",
    [activeTab],
  );

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    setLoginBusy(true);
    try {
      await login(loginState.email, loginState.password);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setLoginError(getErrorMessage(error));
    } finally {
      setLoginBusy(false);
    }
  };

  const handleSignUpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSignUpError(null);
    setSignUpBusy(true);
    try {
      await register({
        name: signUpState.name,
        email: signUpState.email,
        password: signUpState.password,
        clinicName: signUpState.clinicName || undefined,
        specialty: signUpState.specialty || undefined,
      });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setSignUpError(getErrorMessage(error));
    } finally {
      setSignUpBusy(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen flex-col bg-[#f7f2f2]"
      style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}
    >

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-16 lg:flex-row lg:items-center lg:justify-between lg:py-0">
        <section
          className="flex flex-1 flex-col items-center gap-0"
          style={{ marginTop: "-145px" }}
        >
          <img
            src={LOGO_URL}
            alt="MedFlow logo"
            className="block h-auto w-[720px] md:w-[800px] -mb-32"
          />
          <div className="max-w-lg text-center">
            <h1 className="text-3xl font-semibold text-[#0f172a] sm:text-4xl">
              Focus on patients. Let MedFlow handle the rest.
            </h1>
            <p className="mt-4 text-lg text-[#4b5563]">
              Streamline clinical documentation, scheduling, and real-time insights
              with an agentic assistant built for modern practices.
            </p>
          </div>
          <p className="sr-only">{subtitle}</p>
        </section>

        <section className="w-full max-w-md">
          <Card className="border-emerald-100/60 bg-white/90 shadow-xl">
            <CardHeader className="pb-4">
              <Tabs
                defaultValue="login"
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 rounded-xl bg-emerald-50/70">
                  <TabsTrigger value="login" className="rounded-lg">
                    Login
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-lg">
                    Sign Up
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="login" className="mt-6">
                  <CardTitle className="text-2xl text-[#0f172a]">Welcome Back</CardTitle>
                </TabsContent>
                <TabsContent value="signup" className="mt-6">
                  <CardTitle className="text-2xl text-[#0f172a]">Create your account</CardTitle>
                </TabsContent>
              </Tabs>
            </CardHeader>

            <CardContent className="space-y-6">
              {activeTab === "login" ? (
                <form className="space-y-5" onSubmit={handleLoginSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="dr.smith@hospital.com"
                      value={loginState.email}
                      onChange={(event) =>
                        setLoginState((prev) => ({ ...prev, email: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Label htmlFor="password">Password</Label>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={loginState.password}
                      onChange={(event) =>
                        setLoginState((prev) => ({ ...prev, password: event.target.value }))
                      }
                      required
                    />
                  </div>
                  {loginError ? (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {loginError}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    className="medflow-primary-button h-11 w-full rounded-xl text-sm font-semibold"
                    disabled={loginBusy}
                  >
                    {loginBusy ? "Logging in..." : "Log in"}
                  </Button>
                </form>
              ) : (
                <form className="space-y-5" onSubmit={handleSignUpSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      placeholder="Dr. Taylor Smith"
                      value={signUpState.name}
                      onChange={(event) =>
                        setSignUpState((prev) => ({ ...prev, name: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email address</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="dr.smith@hospital.com"
                      value={signUpState.email}
                      onChange={(event) =>
                        setSignUpState((prev) => ({ ...prev, email: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a secure password"
                      value={signUpState.password}
                      onChange={(event) =>
                        setSignUpState((prev) => ({ ...prev, password: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="clinic">Clinic name</Label>
                      <Input
                        id="clinic"
                        placeholder="MedFlow Clinic"
                        value={signUpState.clinicName}
                        onChange={(event) =>
                          setSignUpState((prev) => ({ ...prev, clinicName: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specialty">Specialty</Label>
                      <Input
                        id="specialty"
                        placeholder="Cardiology"
                        value={signUpState.specialty}
                        onChange={(event) =>
                          setSignUpState((prev) => ({ ...prev, specialty: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  {signUpError ? (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {signUpError}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    className="medflow-primary-button h-11 w-full rounded-xl text-sm font-semibold"
                    disabled={signUpBusy}
                  >
                    {signUpBusy ? "Creating workspace..." : "Create workspace"}
                  </Button>
                </form>
              )}

              <div className="border-t border-emerald-100/80 pt-4 space-y-2">
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1E2A38]">
                  Precision care, simplified workflow
                </p>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Demo Account</p>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-medium">Email</span>
                    <span className="font-mono text-slate-800">demo@medflow.app</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
                    <span className="font-medium">Password</span>
                    <span className="font-mono text-slate-800">medflow-demo</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
};

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const msg = (error.response?.data as { error?: { message?: string } })?.error?.message;
    if (msg) return msg;
  }
  if (error instanceof Error) return error.message || "Something went wrong. Please try again.";
  if (typeof error === "string") return error;
  return "Something went wrong. Please try again.";
}

export default Login;
