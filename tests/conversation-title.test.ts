import { describe, expect, it } from "vitest";
import { subtitleOf, titleOf } from "@/lib/data/messages";
import type { ActorSummary } from "@/lib/types";

/**
 * Título da conversa.
 *
 * O Mestre entra na mesma conversa por vários personagens, e a DM direta ficava
 * idêntica à de qualquer jogador: a linha da caixa dizia só com quem, nunca por
 * quem. O NPC que ele está usando entra entre parênteses.
 *
 * A regra é estreita de propósito: parênteses só para o NPC de quem olha, e
 * nunca em grupo. O jogador vê a DM do NPC como qualquer outra, sem a contabilidade
 * do Mestre; e o grupo continua se chamando pelo nome que recebeu.
 */

function actor(id: string, displayName: string, username: string, isNpc: boolean | null = null): ActorSummary {
  return {
    id,
    display_name: displayName,
    username,
    avatar_url: null,
    banner_url: null,
    avatar_position_x: 50,
    avatar_position_y: 50,
    banner_position_y: 50,
    entity_type: "character",
    entity_id: `char_${id}`,
    is_npc: isNpc,
    organization_type: null,
  };
}

// Os nomes e handles são os de verdade: o @ que aparece no cabeçalho tem de
// bater com o que a pessoa lê no perfil.
const mad = actor("mad", "Mad🖤", "Madn3S5", true);
const henri = actor("henri", "Henri Ferrier", "henri", false);
const autumn = actor("autumn", "🌲Autumn🌲", "AutumnOutono", false);
const alecrim = actor("alecrim", "Alecrim", "alecrim", false);

/** As duas identidades do Mestre: o personagem dele e o NPC da mesa. */
const gm = new Set([autumn.id, mad.id]);
/** O jogador tem só o personagem dele. */
const player = new Set([henri.id]);

describe("título de conversa direta", () => {
  it("mostra o NPC do Mestre entre parênteses", () => {
    expect(titleOf({ kind: "direct", title: null }, [henri, mad], gm)).toBe("Henri Ferrier (Mad🖤)");
  });

  it("não mostra parênteses para o jogador, que não tem NPC na mesa", () => {
    expect(titleOf({ kind: "direct", title: null }, [henri, mad], player)).toBe("Mad🖤");
  });

  it("não mostra parênteses quando o Mestre está falando como o próprio personagem", () => {
    expect(titleOf({ kind: "direct", title: null }, [henri, autumn], gm)).toBe("Henri Ferrier");
  });

  it("não mostra parênteses em DM entre dois jogadores", () => {
    expect(titleOf({ kind: "direct", title: null }, [henri, alecrim], new Set([alecrim.id]))).toBe(
      "Henri Ferrier",
    );
  });

  it("separa com vírgula quando o Mestre tem mais de um NPC na conversa", () => {
    const mad2 = actor("mad2", "Sara", "sara", true);
    expect(titleOf({ kind: "direct", title: null }, [henri, mad, mad2], new Set([...gm, mad2.id]))).toBe(
      "Henri Ferrier (Mad🖤, Sara)",
    );
  });

  it("não inventa nome quando a conversa direta só tem identidades próprias", () => {
    expect(titleOf({ kind: "direct", title: null }, [autumn], gm)).toBe("Conversa direta");
  });
});

describe("título de conversa em grupo", () => {
  it("é sempre o nome do grupo, mesmo com o Mestre dentro como NPC", () => {
    expect(titleOf({ kind: "group", title: "Os que prestam do argos" }, [henri, mad, autumn], gm)).toBe(
      "Os que prestam do argos",
    );
  });

  it("cai no genérico quando o grupo não tem nome", () => {
    expect(titleOf({ kind: "group", title: null }, [henri, mad], gm)).toBe("Conversa");
  });
});

describe("subtítulo de conversa direta", () => {
  it("mostra só o @ do outro, para o Mestre não ver o próprio sem saber qual é", () => {
    expect(subtitleOf({ kind: "direct" }, [henri, mad], gm)).toBe("@henri");
  });

  it("é o mesmo para o jogador: a DM do NPC não ganha marca de Mestre", () => {
    expect(subtitleOf({ kind: "direct" }, [henri, mad], player)).toBe("@Madn3S5");
  });

  it("fica vazio quando só tem identidades próprias", () => {
    expect(subtitleOf({ kind: "direct" }, [autumn], gm)).toBe("");
  });
});

describe("subtítulo de conversa em grupo", () => {
  it("conta quem participa", () => {
    expect(subtitleOf({ kind: "group" }, [henri, mad, autumn], gm)).toBe(
      "Henri Ferrier, Mad🖤, 🌲Autumn🌲 · 3 participantes",
    );
  });

  it("acerta o singular", () => {
    expect(subtitleOf({ kind: "group" }, [mad], gm)).toBe("Mad🖤 · 1 participante");
  });
});
