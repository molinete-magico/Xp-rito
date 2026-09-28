import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";

export default function LoginPage() {
  return (
    <AuthShell
      title="Entre na rede"
      footer="entrada restrita aos participantes"
    >
      <LoginForm />
    </AuthShell>
  );
}