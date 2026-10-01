// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ActorSummary, ConversationCard } from "@/lib/types";
import type { Viewer } from "@/lib/session";

/**
 * Reexibir uma conversa que estava oculta.
 *
 * Esconder conversation tirava a linha da caixa e não sobrava lugar nenhum na
 * tela para trazê-la de volta — o botão só aparecia dentro da conversa aberta, e
 * a conversa oculta não estava mais na caixa para ser aberta. Quem escondesse a
 * última conversa ainda caía no estado vazio, que também não tinha saída.
 *
 * O que trava aqui é o caminho inverso inteiro: a seção de ocultas existe
 * mesmo quando a caixa está vazia, o botão reexibe, e a falha do banco devolve
 * a linha em vez de deixá-la sumir.
 */

const { unhideConversationAction } = vi.hoisted(() => ({ unhideConversationAction: vi.fn() }));

vi.mock("@/app/actions/messages", () => ({ unhideConversationAction }));

const { HiddenConversations } = await import("@/components/messages/hidden-conversations");

const autumn: ActorSummary = {
  id: "aaaaaaa1-0000-4000-8000-000000000001",
  entity_id: "c1",
  display_name: "Autumn",
  username: "autumn",
  avatar_url: null,
  banner_url: null,
  avatar_position_x: 50,
  avatar_position_y: 50,
  banner_position_y: 50,
  entity_type: "character",
  is_npc: false,
  organization_type: null,
};

const helena: ActorSummary = {
  ...autumn,
  id: "ccccccc3-0000-4000-8000-000000000003",
  display_name: "Helena",
  username: "helenaduarte",
  is_npc: true,
};

const viewer: Viewer = {
  userId: "u1",
  isGm: true,
  identities: [autumn],
  activeActorId: autumn.id,
  profile: {
    id: "u1",
    username: "mestre",
    display_name: "Mestre",
    avatar_url: null,
    role: "gm",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
};

function card(overrides: Partial<ConversationCard> = {}): ConversationCard {
  return {
    id: "eeeeeee5-0000-4000-8000-000000000005",
    kind: "direct",
    title: "Helena",
    last_message_at: "2026-01-01T12:00:00.000Z",
    preview: "Você não viu essa hora",
    participants: [autumn, helena],
    unread: 2,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  unhideConversationAction.mockReset();
});

function setup(conversations: ConversationCard[], onRestored = vi.fn()) {
  render(
    <HiddenConversations conversations={conversations} viewer={viewer} onRestored={onRestored} />,
  );
  return { onRestored };
}

describe("conversas ocultas", () => {
  it("começa fechada, mas diz quantas são", () => {
    setup([card(), card({ id: "f6", title: "Os acéticos" })]);

    const toggle = screen.getByRole("button", { name: /ocultas/i });
    expect(toggle).toHaveTextContent("2");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Fechada: a conversa não está no DOM, e o botão dela também não.
    expect(screen.queryByText("Helena")).toBeNull();
    expect(screen.queryByRole("button", { name: /reexibir/i })).toBeNull();
  });

  it("abre a lista e reexibe a conversa escolhida", async () => {
    unhideConversationAction.mockResolvedValue({});
    const { onRestored } = setup([card(), card({ id: "f6", title: "Os acéticos" })]);

    fireEvent.click(screen.getByRole("button", { name: /ocultas/i }));
    expect(screen.getByRole("button", { name: /ocultas/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    const button = screen.getByRole("button", { name: "Reexibir a conversa Helena" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(unhideConversationAction).toHaveBeenCalledWith("eeeeeee5-0000-4000-8000-000000000005");
    });
    // A caixa precisa ser recarregada: é ela que passa a mostrar a conversa.
    await waitFor(() => {
      expect(onRestored).toHaveBeenCalledTimes(1);
    });
    // A outra oculta continua na lista, com o botão intacto.
    expect(screen.getByRole("button", { name: "Reexibir a conversa Os acéticos" })).toBeTruthy();
  });

  it("quando o banco recusa, a linha fica e o motivo aparece", async () => {
    unhideConversationAction.mockResolvedValue({ error: "Não foi possível reexibir a conversa." });
    const { onRestored } = setup([card()]);

    fireEvent.click(screen.getByRole("button", { name: /ocultas/i }));
    fireEvent.click(screen.getByRole("button", { name: "Reexibir a conversa Helena" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível reexibir a conversa.");
    });
    // A conversa não pode sumir da tela se ela continua oculta no banco.
    expect(screen.getByRole("button", { name: "Reexibir a conversa Helena" })).toBeTruthy();
    expect(onRestored).not.toHaveBeenCalled();
  });

  it("o nome do botão diz qual conversa volta, para leitor de tela", () => {
    setup([card({ kind: "group", title: "Os acéticos", participants: [autumn, helena] })]);

    fireEvent.click(screen.getByRole("button", { name: /ocultas/i }));

    // O rótulo acessível não pode ser só "Reexibir": com várias ocultas, a
    // pessoa precisa saber qual está devolvendo.
    expect(screen.getByRole("button", { name: "Reexibir a conversa Os acéticos" })).toBeTruthy();
  });
});
