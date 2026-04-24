import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { login } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, Zap } from "lucide-react";
import heroImg from "@/assets/airport-hero.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Airport Meter Reading" },
      {
        name: "description",
        content: "Staff login for airport concessioner electric meter reading system.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const session = login(username, password);
    if (session) {
      navigate({ to: "/" });
    } else {
      setError("Invalid username or password");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <img
        src={heroImg}
        alt="Airport terminal at twilight"
        className="absolute inset-0 w-full h-full object-cover"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-overlay" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary shadow-glow mb-4">
            <Plane className="w-8 h-8 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Meter Reading System
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-mono uppercase tracking-widest">
            Concessioner · Electrical
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-elevated space-y-5"
        >
          <div className="space-y-2">
            <Label
              htmlFor="username"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Staff ID
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
              className="bg-input border-border h-11"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Passcode
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="bg-input border-border h-11"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-gradient-primary text-primary-foreground font-semibold tracking-wide hover:opacity-90 transition-smooth shadow-glow"
          >
            <Zap className="w-4 h-4 mr-2" />
            {loading ? "Authenticating…" : "Sign In"}
          </Button>

          <div className="text-xs text-center text-muted-foreground font-mono pt-2 border-t border-border/50">
            Demo: <span className="text-runway">admin</span> /{" "}
            <span className="text-runway">meter@123</span>
          </div>
        </form>
      </div>
    </div>
  );
}
