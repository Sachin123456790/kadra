import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { request } from "./api";
import { Field, Input, Button, ErrorBox } from "./ui";
export function Login({ onLogin }: { onLogin: () => void }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    inviteCode: "",
  });
  const mutation = useMutation({
    mutationFn: () =>
      request(`/auth/${register ? "register" : "login"}`, "POST", form),
    onSuccess: onLogin,
  });
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-7 rounded-xl border border-border bg-card p-8">
        <img
          src="/logo-combomark-white.svg"
          className="hidden h-7 dark:block"
          alt="Angainor"
        />
        <img
          src="/logo-combomark-black.svg"
          className="h-7 dark:hidden"
          alt="Angainor"
        />
        <div>
          <p className="workspace-eyebrow mb-2">
            Control Room · Private sandbox
          </p>
          <h1 className="text-2xl font-semibold">
            {register ? "Create your sandbox" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your own persistent workspace, with fictional seed data and private
            document uploads.
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {(register
            ? ["name", "email", "password", "inviteCode"]
            : ["email", "password"]
          ).map((key) => (
            <Field
              key={key}
              label={
                {
                  name: "Your name",
                  email: "Email",
                  password: "Password",
                  inviteCode: "Invitation code",
                }[key]
              }
            >
              <Input
                required
                type={
                  key === "password"
                    ? "password"
                    : key === "email"
                      ? "email"
                      : "text"
                }
                autoComplete={
                  key === "password"
                    ? register
                      ? "new-password"
                      : "current-password"
                    : key === "email"
                      ? "email"
                      : "off"
                }
                minLength={key === "password" && register ? 12 : undefined}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </Field>
          ))}
          <ErrorBox error={mutation.error} />
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {register ? "Create private sandbox" : "Sign in"}
          </Button>
        </form>
        <button
          className="text-xs text-primary"
          onClick={() => {
            setRegister(!register);
            mutation.reset();
          }}
        >
          {register
            ? "Already have an account? Sign in"
            : "Have an invitation? Create a sandbox"}
        </button>
      </div>
    </div>
  );
}
