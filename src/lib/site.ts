/**
 * Identidade da rede. Trocar o nome do RPG é uma edição neste arquivo — nada
 * no resto da aplicação presume um nome específico.
 */
export const site = {
  name: "Xpírito",
  description:
    "Rede privada da mesa: personagens, pessoas e instituições publicam, respondem e acompanham umas às outras.",
} as const;

/** Rotulagem dos tipos de entidade, no vocabulário do RPG. */
export const organizationTypeLabels = {
  organization: "Organização",
  institution: "Instituição",
  media: "Veículo",
  company: "Empresa",
  group: "Grupo",
  other: "Entidade",
} as const;

export const accountTypeLabels = {
  character: "Personagem",
  npc: "NPC",
  organization: "Organização",
  institution: "Instituição",
  media: "Veículo",
  company: "Empresa",
  group: "Grupo",
  other: "Entidade",
} as const;

export type AccountType = keyof typeof accountTypeLabels;

/** Rótulo da conta social a partir do actor. */
export function accountTypeOf(actor: {
  entity_type: "character" | "organization";
  organization_type?: string | null;
  is_npc?: boolean | null;
}): AccountType {
  if (actor.entity_type === "character") {
    return actor.is_npc ? "npc" : "character";
  }
  return (actor.organization_type as AccountType) ?? "other";
}
