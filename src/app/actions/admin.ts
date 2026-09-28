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

export async function deleteNpcAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  if (!viewer.isGm) return;
  const id = String(formData.get("characterId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("characters").delete().eq("id", id).eq("is_npc", true);
  revalidatePath("/admin");
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

export async function deleteOrganizationAction(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  if (!viewer.isGm) return;
  const id = String(formData.get("organizationId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("organizations").delete().eq("id", id);
  revalidatePath("/admin");
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