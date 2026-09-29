"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import {
  characterSchema,
  organizationSchema,
  fieldErrors,
  type ActionState,
} from "@/lib/validation/schemas";
import type { OrganizationType } from "@/types/database";

/**
 * Painel do Mestre.
 *
 * Personagens sem dono (NPC) e organizações são o que o Mestre controla além dos
 * próprios personagens. A autorização mora no RLS (`can_manage_actor` = gm para
 * estes registros); estas actions só traduzem o FormData em campos e devolvem
 * mensagens.
 */

export async function createNpcAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  if (!viewer.isGm) return { ok: false, message: "Só o Mestre administra a cidade." };

  const parsed = characterSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    bio: formData.get("bio") || null,
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("characters")
    .insert({
      owner_id: null,
      is_npc: true,
      name: parsed.data.name,
      username: parsed.data.username,
      bio: parsed.data.bio,
    });

  if (error) return { ok: false, message: describeError(error.message) };

  revalidatePath("/admin");
  return { ok: true, message: "NPC criado." };
}

export async function updateNpcAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  if (!viewer.isGm) return { ok: false, message: "Só o Mestre administra a cidade." };

  const id = String(formData.get("characterId") ?? "");
  if (!id) return { ok: false, message: "Faltou a identificação do NPC." };

  const parsed = characterSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    bio: formData.get("bio") || null,
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("characters")
    .update({
      name: parsed.data.name,
      username: parsed.data.username,
      bio: parsed.data.bio,
    })
    .eq("id", id)
    .eq("is_npc", true);

  if (error) return { ok: false, message: describeError(error.message) };

  revalidatePath("/admin");
  revalidatePath(`/profile/${parsed.data.username}`);
  revalidatePath("/explore");
  return { ok: true, message: "NPC atualizado." };
}

export async function deleteNpcAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();
  if (!viewer.isGm) return { ok: false, message: "Só o Mestre administra a cidade." };

  const id = String(formData.get("characterId") ?? "");
  if (!id) return { ok: false, message: "Faltou identificar o NPC." };

  const supabase = await createClient();
  const { error } = await supabase.from("characters").delete().eq("id", id).eq("is_npc", true);
  if (error) return { ok: false, message: describeError(error.message) };

  revalidatePath("/admin");
  revalidatePath("/home");
  return { ok: true, message: "NPC apagado." };
}

/**
 * Mestre assume um personagem de jogador: vira NPC (sem dono). O RLS aceita
 * porque `can_edit_character` é gm ou dono; o guarda `.eq("is_npc", false)`
 * impede que um NPC seja "tomado" de novo por acidente.
 */
export async function takePlayerCharacterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();
  if (!viewer.isGm) return { ok: false, message: "Só o Mestre administra a cidade." };

  const id = String(formData.get("characterId") ?? "");
  if (!id) return { ok: false, message: "Faltou identificar o personagem." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("characters")
    .update({ is_npc: true, owner_id: null })
    .eq("id", id)
    .eq("is_npc", false);

  if (error) return { ok: false, message: describeError(error.message) };

  revalidatePath("/admin");
  revalidatePath("/home");
  return { ok: true, message: "Personagem agora é da mesa (NPC)." };
}

/**
 * Entrega um NPC a um jogador: o personagem passa a ter dono de verdade. O
 * destino precisa ser um perfil com papel `player`; só NPC (is_npc) entra.
 */
export async function grantNpcAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();
  if (!viewer.isGm) return { ok: false, message: "Só o Mestre administra a cidade." };

  const id = String(formData.get("characterId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  if (!id || !playerId) {
    return { ok: false, message: "Faltou identificar o personagem ou o jogador." };
  }

  const supabase = await createClient();
  const { data: player } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", playerId)
    .eq("role", "player")
    .maybeSingle();
  if (!player) {
    return { ok: false, message: "Jogador não encontrado. Entregue apenas para papel de jogador." };
  }

  const { error } = await supabase
    .from("characters")
    .update({ is_npc: false, owner_id: playerId })
    .eq("id", id)
    .eq("is_npc", true);

  if (error) return { ok: false, message: describeError(error.message) };

  revalidatePath("/admin");
  revalidatePath("/home");
  return { ok: true, message: "Personagem entregue ao jogador." };
}

export async function createOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();
  if (!viewer.isGm) return { ok: false, message: "Só o Mestre administra a cidade." };

  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    description: formData.get("description") || null,
    type: formData.get("type"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").insert({
    name: parsed.data.name,
    username: parsed.data.username,
    description: parsed.data.description,
    type: parsed.data.type as OrganizationType,
  });

  if (error) return { ok: false, message: describeError(error.message) };

  revalidatePath("/admin");
  return { ok: true, message: "Organização criada." };
}

export async function updateOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();
  if (!viewer.isGm) return { ok: false, message: "Só o Mestre administra a cidade." };

  const id = String(formData.get("organizationId") ?? "");
  if (!id) return { ok: false, message: "Faltou a organização." };

  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    description: formData.get("description") || null,
    type: formData.get("type"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      username: parsed.data.username,
      description: parsed.data.description,
      type: parsed.data.type as OrganizationType,
    })
    .eq("id", id);

  if (error) return { ok: false, message: describeError(error.message) };

  revalidatePath("/admin");
  revalidatePath(`/profile/${parsed.data.username}`);
  revalidatePath("/explore");
  return { ok: true, message: "Organização atualizada." };
}

export async function deleteOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();
  if (!viewer.isGm) return { ok: false, message: "Só o Mestre administra a cidade." };

  const id = String(formData.get("organizationId") ?? "");
  if (!id) return { ok: false, message: "Faltou identificar a organização." };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").delete().eq("id", id);
  if (error) return { ok: false, message: describeError(error.message) };

  revalidatePath("/admin");
  revalidatePath("/home");
  return { ok: true, message: "Organização apagada." };
}

function describeError(message: string): string {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "O banco recusou. Confira se a política desse registro inclui o Mestre.";
  }
  if (message.includes("_username_key")) return "Esse @handle já está em uso.";
  if (message.includes("username_charset") || message.includes("username_no_")) {
    return "O @handle só aceita minúsculas, números, ponto e sublinhado.";
  }
  if (message.includes("bio_len")) return "A bio passa de 300 caracteres.";
  if (message.includes("display_name_len")) return "O nome passa de 80 caracteres.";
  return "Não foi possível salvar agora.";
}