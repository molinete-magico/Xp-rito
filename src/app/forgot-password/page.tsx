import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Esqueceu a senha"
      footer="tudo criptografado pelo Supabase Auth"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}