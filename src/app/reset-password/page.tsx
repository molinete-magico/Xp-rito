import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Nova senha"
      footer="válido por uma troca"
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}