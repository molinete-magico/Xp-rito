import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-forms";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Sua conta na mesa"
      footer="a rede é fechada: só entra quem o Mestre cadastra"
    >
      <RegisterForm />
    </AuthShell>
  );
}