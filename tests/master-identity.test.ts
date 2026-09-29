import { describe, expect, it } from "vitest";
import { preferredActiveActorId } from "@/lib/data/identities";
import type { ActorSummary } from "@/lib/types";

function actor(
  id: string,
  entityType: "character" | "organization",
  isNpc: boolean | null,
): ActorSummary {
  return {
    id,
    entity_id: id,
    display_name: id,
    username: id,
    avatar_url: null,
    banner_url: null,
    avatar_position_x: 50,
    avatar_position_y: 50,
    banner_position_y: 50,
    entity_type: entityType,
    is_npc: isNpc,
    organization_type: null,
  };
}

describe("preferredActiveActorId", () => {
  it("prefere personagem do próprio usuário antes de NPC e organização", () => {
    expect(
      preferredActiveActorId([
        actor("org", "organization", null),
        actor("npc", "character", true),
        actor("player", "character", false),
      ]),
    ).toBe("player");
  });

  it("usa NPC quando o Mestre não tem personagem próprio", () => {
    expect(
      preferredActiveActorId([
        actor("org", "organization", null),
        actor("npc", "character", true),
      ]),
    ).toBe("npc");
  });

  it("usa organização apenas quando não há personagem", () => {
    expect(preferredActiveActorId([actor("org", "organization", null)])).toBe("org");
  });

  it("retorna null sem identidades", () => {
    expect(preferredActiveActorId([])).toBeNull();
  });
});
