// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";

/**
 * A troca de identidade só vale depois que o banco aceita.
 *
 * O cookie é httpOnly e quem autoriza é `can_manage_actor`, então a tela não
 * pode trocar na hora: se ela trocar e o banco recusar, a identidade antiga
 * continua no cookie, a próxima navegação desfaz o que a pessoa viu, e o
 * espelho em `localStorage` fica apontando para uma voz que ninguém autorizou.
 *
 * Aqui está o ponto exato da garantia, porque `session-provider` é quem decide
 * quando o espelho local é escrito. A tela só consome o resultado.
 */

const { setActiveActorAction, writeActiveActor, buildClientViewer, createClient } = vi.hoisted(() => ({
  setActiveActorAction: vi.fn(),
  writeActiveActor: vi.fn(),
  buildClientViewer: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/app/actions/auth", () => ({ setActiveActorAction, getActiveActorAction: vi.fn(async () => null) }));
// O router precisa ser a mesma referência em toda render: o provider o tem na
// lista de dependências do efeito de sessão, e um objeto novo a cada render
// faria o efeito repetir sozinho, sem parar.
const { router } = vi.hoisted(() => ({ router: { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/storage", () => ({ writeActiveActor, readActiveActor: () => null }));
vi.mock("@/lib/session-client", () => ({ buildClientViewer }));
vi.mock("@/lib/supabase/client", () => ({ createClient }));

const { SessionProvider, useSession } = await import("@/components/shell/session-provider");

/** Botão que troca de identidade e guarda o que a sessão respondeu. */
function Switcher({ onResult }: { onResult: (allowed: boolean) => void }) {
  const { setActiveActor } = useSession();
  return (
    <button
      type="button"
      onClick={async () => {
        onResult(await setActiveActor("mad"));
      }}
    >
      trocar
    </button>
  );
}

/** Recurso mínimo: `getUser` com sessão e um `auth.onAuthStateChange` inerte. */
function browser() {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("troca de identidade na sessão", () => {
  it("não escreve o espelho local quando o banco recusa", async () => {
    createClient.mockReturnValue(browser());
    buildClientViewer.mockResolvedValue({
      userId: "u1",
      isGm: true,
      identities: [],
      activeActorId: "autumn",
    });
    setActiveActorAction.mockResolvedValue(false);
    const results: boolean[] = [];

    render(
      <SessionProvider>
        <Switcher onResult={(allowed) => results.push(allowed)} />
      </SessionProvider>,
    );
    await waitFor(() => expect(buildClientViewer).toHaveBeenCalled());
    await act(async () => {
      document.querySelector("button")!.click();
    });

    // A recusa precisa chegar a quem chamou, e o espelho não pode ser escrito:
    // ele é o que a página seguinte lê para saber com quem se está falando.
    expect(results).toEqual([false]);
    expect(writeActiveActor).not.toHaveBeenCalled();
  });

  it("escreve o espelho local quando o banco aceita", async () => {
    createClient.mockReturnValue(browser());
    buildClientViewer.mockResolvedValue({
      userId: "u1",
      isGm: true,
      identities: [],
      activeActorId: "autumn",
    });
    setActiveActorAction.mockResolvedValue(true);
    const results: boolean[] = [];

    render(
      <SessionProvider>
        <Switcher onResult={(allowed) => results.push(allowed)} />
      </SessionProvider>,
    );
    await waitFor(() => expect(buildClientViewer).toHaveBeenCalled());
    await act(async () => {
      document.querySelector("button")!.click();
    });

    expect(results).toEqual([true]);
    expect(writeActiveActor).toHaveBeenCalledWith("mad");
  });

  it("trocas em fila não se embaralham, e a última manda", async () => {
    createClient.mockReturnValue(browser());
    buildClientViewer.mockResolvedValue({
      userId: "u1",
      isGm: true,
      identities: [],
      activeActorId: "autumn",
    });
    // A primeira resposta é lenta: se as duas corressem juntas, a segunda
    // sobrescreveria o espelho com a voz que a pessoa pediu por último.
    setActiveActorAction.mockImplementation(async (actorId: string) => {
      await new Promise((resolve) => setTimeout(resolve, actorId === "mad" ? 20 : 0));
      return true;
    });

    render(
      <SessionProvider>
        <Switcher onResult={() => {}} />
      </SessionProvider>,
    );
    await waitFor(() => expect(buildClientViewer).toHaveBeenCalled());

    await act(async () => {
      const button = document.querySelector("button")!;
      button.click();
      button.click();
    });
    await waitFor(() => expect(setActiveActorAction).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(writeActiveActor).toHaveBeenCalledTimes(1));
    // Só a última troca escreve: a intermediária foi superada.
    expect(writeActiveActor).toHaveBeenCalledWith("mad");
  });
});
