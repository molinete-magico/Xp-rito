// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ActorSummary } from "@/lib/types";

/**
 * Elenco de identidades do Mestre.
 *
 * O botão na coluna da esquerda é o caminho para os NPCs sem depender do
 * compositor: o Painel do Mestre e /mensagens não têm caixinha nenhuma, e era lá
 * que o Mestre ficava sem trocar de personagem.
 *
 * O ponto que o teste segura é a quantidade. A lista do Mestre cresce com a
 * mesa, e o defeito era a lista passar da altura da janela sem ter rolagem: o
 * fim da lista — justamente os NPCs de baixo — ficava fora de alcance.
 */

// A troca mora na sessão, que é quem chama a Action e só escreve o espelho
// local quando o banco aceita; o roster só acompanha e mostra a recusa.
const { setActiveActor, refresh, viewerState } = vi.hoisted(() => ({
  setActiveActor: vi.fn(),
  refresh: vi.fn(),
  viewerState: {
    current: null as {
      userId: string;
      isGm: boolean;
      activeActorId: string | null;
      identities: unknown[];
    } | null,
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("@/components/shell/session-provider", () => ({
  useSession: () => ({
    viewer: viewerState.current,
    client: null,
    isLoading: false,
    setActiveActor,
    refresh,
  }),
}));

const { IdentityRosterButton } = await import("@/components/shell/identity-roster");

/** A identidade ativa e o elenco moram na sessão; o botão lê de lá, não de prop. */
function signedInAs(activeActorId: string | null, identities: unknown[] = []) {
  viewerState.current = { userId: "u1", isGm: true, activeActorId, identities };
}

function character(id: string, displayName: string, isNpc: boolean): ActorSummary {
  return {
    id,
    entity_id: `char_${id}`,
    display_name: displayName,
    username: displayName.replaceAll(/\W+/g, "-").toLowerCase(),
    avatar_url: null,
    banner_url: null,
    avatar_position_x: 50,
    avatar_position_y: 50,
    banner_position_y: 50,
    entity_type: "character",
    is_npc: isNpc,
    organization_type: null,
  };
}

/** O elenco real do Mestre: o personagem dele e os quatro NPCs da mesa. */
const autumn = character("autumn", "🌲Autumn🌲", false);
const mad = character("mad", "Mad🖤", true);
const alecrim = character("alecrim", "Alecrim", true);
const claws = character("claws", "Claws", true);
const ismael = character("ismael", "NÃO É O ISMAEL", true);
const realRoster = [autumn, mad, alecrim, claws, ismael];

function openPanel(identities: ActorSummary[], activeActorId: string | null) {
  signedInAs(activeActorId, identities);
  render(<IdentityRosterButton />);
  fireEvent.click(screen.getByRole("button", { name: /personagens/i }));
  return screen.getByRole("menu", { name: "Personagens" });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  viewerState.current = null;
});

describe("botão de personagens do Mestre", () => {
  it("mostra com quem se está falando", () => {
    signedInAs(mad.id, realRoster);
    render(<IdentityRosterButton />);
    expect(screen.getByRole("button", { name: /falando como Mad🖤/ })).toBeTruthy();
  });

  it("lista o personagem do Mestre e os NPCs da mesa", () => {
    const panel = openPanel(realRoster, autumn.id);
    for (const actor of realRoster) {
      expect(panel.textContent).toContain(actor.display_name);
    }
  });

  it("separa o personagem do Mestre dos NPCs, que se procuram em listas diferentes", () => {
    const panel = openPanel(realRoster, autumn.id);
    const npcs = panel.textContent?.indexOf("NPCs da mesa") ?? -1;
    const mad = panel.textContent?.indexOf("Mad🖤") ?? -1;
    const madBeforeLabel = mad !== -1 && mad < npcs;
    expect(madBeforeLabel).toBe(false);
  });

  it("não repete o ativo na lista: ele fica marcado no topo", () => {
    const panel = openPanel(realRoster, autumn.id);
    // A contagem vai no nome visível do NPC, não no textContent inteiro: o
    // Avatar decorativo escreve um "Sem foto de Mad🖤" em sr-only, que também é
    // texto da tela para o leitor de tela e contaria como uma segunda aparição.
    const names = [...panel.querySelectorAll("[data-identity-name]")].map(
      (node) => node.textContent,
    );
    expect(names.filter((name) => name === "Mad🖤")).toHaveLength(1);
  });

  it("não esconde personagem nenhum quando a mesa é grande", () => {
    const muitos = [
      autumn,
      ...Array.from({ length: 30 }, (_, i) => character(`npc${i}`, `NPC ${i}`, true)),
    ];
    const panel = openPanel(muitos, autumn.id);
    for (const actor of muitos) {
      expect(panel.textContent).toContain(actor.display_name);
    }
  });

  it("rola a lista com teto de altura, senão o fim some da tela", () => {
    const panel = openPanel(realRoster, autumn.id);
    expect(panel.className).toContain("overflow-y-auto");
    expect(panel.className).toMatch(/max-h-/);
  });

  it("some quando não há identidade nenhuma", () => {
    signedInAs(null, []);
    const { container } = render(<IdentityRosterButton />);
    expect(container.querySelector("button")).toBeNull();
  });
});

describe("troca de identidade só vale depois do banco responder", () => {
  it("troca de personagem pelo botão", async () => {
    setActiveActor.mockResolvedValue(true);
    openPanel(realRoster, autumn.id);
    fireEvent.click(screen.getByRole("menuitem", { name: /Mad🖤/ }));
    expect(setActiveActor).toHaveBeenCalledWith(mad.id);
    // A tela espera a confirmação: trocar antes seria trocar e voltar sozinho
    // quando o banco recusa, que era o defeito.
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("quando o banco recusa, a identidade antiga continua marcada e a pessoa lê o motivo", async () => {
    setActiveActor.mockResolvedValue(false);
    openPanel(realRoster, autumn.id);
    fireEvent.click(screen.getByRole("menuitem", { name: /Mad🖤/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível trocar de personagem.",
    );
    expect(refresh).not.toHaveBeenCalled();
    // A anterior segue no topo: a voz não pode ser outra da que está valendo.
    expect(screen.getByRole("menu", { name: "Personagens" }).textContent).toContain("🌲Autumn🌲");
  });

  it("quando o banco recusa, o menu fica aberto para a recusa ser lida", async () => {
    setActiveActor.mockResolvedValue(false);
    openPanel(realRoster, autumn.id);
    fireEvent.click(screen.getByRole("menuitem", { name: /Mad🖤/ }));
    await screen.findByRole("alert");
    // Fechar antes de saber seria mostrar o erro em uma lista que a pessoa
    // já não está mais vendo.
    expect(screen.getByRole("menu", { name: "Personagens" })).toBeTruthy();
  });

  it("uma segunda troca não embaralha a primeira enquanto ela corre", async () => {
    let release: (value: boolean) => void = () => {};
    setActiveActor.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    openPanel(realRoster, autumn.id);
    fireEvent.click(screen.getByRole("menuitem", { name: /Mad🖤/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Alecrim/ }));

    release(true);
    // A fila é da sessão; aqui o que importa é que a troca concluída seja a que
    // foi pedida, e que a segunda não dispare uma segunda navegação.
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });
});
