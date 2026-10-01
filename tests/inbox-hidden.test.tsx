// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ActorSummary, ConversationCard } from "@/lib/types";
import type { Viewer } from "@/lib/session";

/**
 * A caixa de entrada e as conversas ocultas.
 *
 * O botão de reexibir dentro da conversa aberta não resolvia o problema: a
 * conversa oculta não estava mais na caixa, então não havia como chegar nela
 * para apertar o botão. A seção de ocultas precisa existir na própria caixa, e
 * precisa existir também quando a caixa está vazia — esconder a última conversa
 * leva ao estado vazio, que era o fim da linha.
 */

const { loadInbox, loadHiddenConversations, unhideConversationAction } = vi.hoisted(() => ({
  loadInbox: vi.fn(),
  loadHiddenConversations: vi.fn(),
  unhideConversationAction: vi.fn(),
}));

vi.mock("@/lib/data/messages", () => ({ loadInbox, loadHiddenConversations }));
vi.mock("@/app/actions/messages", () => ({ unhideConversationAction }));
vi.mock("@/components/shell/dm-unread-provider", () => ({
  useDmSignal: () => 0,
  useDmRefreshUnread: () => vi.fn(),
}));
vi.mock("@/components/messages/new-group-button", () => ({
  NewGroupButton: () => <button type="button">Novo grupo</button>,
}));

const { InboxStream } = await import("@/components/messages/inbox-stream");

const autumn = {
  id: "aaaaaaa1-0000-4000-8000-000000000001",
  entity_id: "c1",
  display_name: "Autumn",
  username: "autumn",
  avatar_url: null,
  banner_url: null,
  avatar_position_x: 50,
  avatar_position_y: 50,
  banner_position_y: 50,
  entity_type: "character" as const,
  is_npc: false,
  organization_type: null,
} satisfies ActorSummary;

const helena = { ...autumn, id: "cccccc3-0000-4000-8000-000000000003", display_name: "Helena" };

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

const visible: ConversationCard = {
  id: "visible-1",
  kind: "direct",
  title: "Chilly",
  last_message_at: "2026-01-02T12:00:00.000Z",
  preview: "Vamos",
  participants: [autumn, { ...helena, id: "other-1", display_name: "Chilly" }],
  unread: 0,
};

const hiddenCard: ConversationCard = {
  id: "hidden-1",
  kind: "direct",
  title: "Helena",
  last_message_at: "2026-01-01T12:00:00.000Z",
  preview: "Guys?",
  participants: [autumn, helena],
  unread: 3,
};

beforeEach(() => {
  loadInbox.mockResolvedValue([visible]);
  loadHiddenConversations.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// A sessão entra pronta: aqui interessa a lista, não o que a sessão faz.
vi.mock("@/components/shell/session-provider", () => ({
  useSession: () => ({ viewer, client: {}, isLoading: false }),
}));

describe("caixa de entrada com ocultas", () => {
  it("pergunta ao banco o que está oculto e mostra ao lado da caixa", async () => {
    loadHiddenConversations.mockResolvedValue([hiddenCard]);

    render(<InboxStream />);

    // A carga é o mesmo caminho da caixa, para não ter duas idas ao banco.
    await waitFor(() => {
      expect(loadHiddenConversations).toHaveBeenCalled();
    });
    await screen.findByRole("button", { name: /ocultas/i });
    expect(screen.getByRole("button", { name: /ocultas/i })).toHaveTextContent("1");
    expect(screen.getByText("Chilly")).toBeTruthy();
  });

  it("esconder a última conversa deixa a seção como única saída", async () => {
    loadInbox.mockResolvedValue([]);
    loadHiddenConversations.mockResolvedValue([hiddenCard]);

    render(<InboxStream />);

    // O estado vazio com o botão de grupo… e a seção logo abaixo.
    expect(await screen.findByText("Nenhuma conversa ainda")).toBeTruthy();
    await screen.findByRole("button", { name: /ocultas/i });
  });

  it("reexibir recarrega a caixa e devolve a conversa ao lugar", async () => {
    loadHiddenConversations.mockResolvedValue([hiddenCard]);
    unhideConversationAction.mockResolvedValue({});

    render(<InboxStream />);

    fireEvent.click(await screen.findByRole("button", { name: /ocultas/i }));
    fireEvent.click(screen.getByRole("button", { name: "Reexibir a conversa Helena" }));

    await waitFor(() => {
      expect(unhideConversationAction).toHaveBeenCalledWith("hidden-1");
    });
    // A caixa é recarregada: é ela que passa a listar a conversa.
    await waitFor(() => {
      expect(loadInbox.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it("falha na lista de ocultas não derruba a caixa", async () => {
    loadHiddenConversations.mockRejectedValue(new Error("sem permissão"));

    render(<InboxStream />);

    // A conversa que estava na tela continua na tela.
    expect(await screen.findByText("Chilly")).toBeTruthy();
    // E a seção some, em vez de a caixa inteira virar tela de erro.
    expect(screen.queryByText("Não foi possível carregar suas conversas")).toBeNull();
  });
});
