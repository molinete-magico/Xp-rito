// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ActorProfile } from "@/lib/types";

/**
 * Botão de conversa no perfil.
 *
 * DM direta com uma identidade própria não existe — o banco recusa "Não se abre
 * conversa consigo mesmo". O botão "Mensagem" continuava no lugar e só fazia
 * aparecer o erro em vermelho, e o Mestre caía nisso no perfil de cada NPC
 * dele, que é justamente onde ele vai para montar cena.
 *
 * O que o Mestre ganha no lugar é a conversa em grupo já aberta com o NPC
 * escolhido como voz, que é o caminho que leva o NPC para a mesa.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

// O botão de mensagem e o de grupo leem a sessão; aqui só interessa qual botão
// aparece, não o que a sessão faz com ele.
vi.mock("@/components/shell/session-provider", () => ({
  useSession: () => ({
    viewer: { userId: "u1", isGm: true, identities: [], activeActorId: null, profile: null },
    client: null,
    isLoading: false,
    setActiveActor: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const { ProfileHeader } = await import("@/components/profile/profile-header");

function profile(viewer: Partial<ActorProfile["viewer"]>): ActorProfile {
  return {
    id: "npc-1",
    entity_id: "char-npc-1",
    display_name: "Mad🖤",
    username: "Madn3S5",
    avatar_url: null,
    banner_url: null,
    avatar_position_x: 50,
    avatar_position_y: 50,
    banner_position_y: 50,
    entity_type: "character",
    is_npc: true,
    organization_type: null,
    bio: null,
    entity: {
      id: "char-npc-1",
      kind: "character",
      name: "Mad🖤",
      bio: null,
      banner_url: null,
      is_npc: true,
      type: null,
    },
    stats: { posts: 0, followers: 0, following: 0, likesReceived: 0 },
    viewer: { isSelf: false, isOwnIdentity: false, isFollowing: false, canEdit: false, ...viewer },
  };
}

afterEach(cleanup);

describe("perfil de personagem alheio", () => {
  it("oferece a mensagem direta", () => {
    render(<ProfileHeader profile={profile({})} typeLabel="Personagem" />);
    expect(screen.getByRole("button", { name: /mensagem/i })).toBeTruthy();
  });
});

describe("perfil de NPC do próprio Mestre", () => {
  it("não oferece mensagem direta, que o banco recusa", () => {
    render(<ProfileHeader profile={profile({ isOwnIdentity: true })} typeLabel="NPC" />);
    expect(screen.queryByRole("button", { name: /mensagem/i })).toBeNull();
  });

  it("oferece a conversa em grupo, que é o caminho para o NPC entrar na mesa", () => {
    render(<ProfileHeader profile={profile({ isOwnIdentity: true })} typeLabel="NPC" />);
    expect(screen.getByRole("button", { name: /nova conversa/i })).toBeTruthy();
  });
});

describe("perfil do personagem que está aberto", () => {
  it("não oferece nem mensagem nem grupo", () => {
    render(<ProfileHeader profile={profile({ isSelf: true })} typeLabel="Personagem" />);
    expect(screen.queryByRole("button", { name: /mensagem/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /nova conversa/i })).toBeNull();
  });
});
