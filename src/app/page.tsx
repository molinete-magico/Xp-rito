import { redirect } from "next/navigation";

/**
 * Raiz.
 *
 * Quem já tem sessão vai direto para o feed. Quem não tem chega aqui sem sessão
 * e o proxy já o levou para /login; este redirect evita que a URL / renderize
 * conteúdo órfão.
 */
export default function HomePage() {
  redirect("/home");
}
