"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { dmIdentityOf } from "@/lib/data/identities";
import {
  fieldErrors,
  groupSchema,
  messageSchema,
  type ActionState,
} from "@/lib/validation/schemas";

/**
 * Mensagens privadas.
 *
 * Nenhuma regra de escrita mora aqui: quem decide quem participa, quem pode
 * falar por qual identidade e o que é uma conversa consigo mesmo é o banco
 * (RLS e as funções `public.dm_*`). A Action valida formato e traduz a recusa,
 * que chega em inglês.
 *
 * O remetente é a identidade de DM da pessoa: o personagem que ela está com
 * aberto, se for dela. NPC e organização não têm caixa, e é isso que impede o
 * Mestre de ler a conversa dos jogadores.
 */

export async function sendMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer();

  const parsed = messageSchema.safeParse({
    conversationId: formData.get("conversationId"),
    content: formData.get("content"),
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const sender = dmIdentityOf(viewer);
  if (!sender) {
    return { ok: false, message: "Crie um personagem antes de enviar mensagens." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("dm_messages").insert({
    conversation_id: parsed.data.conversationId,
    actor_id: sender.id,
    content: parsed.data.content,
  });

  if (error) return { ok: false, message: describeMessageError(error.message) };

  revalidateMessages(parsed.data.conversationId);
  return { ok: true };
}

/** Abre (ou reabre) a conversa direta e devolve o id para navegar até ela. */
export async function startDirectAction(
  targetActorId: string,
): Promise<{ conversationId: string } | { error: string }> {
  const viewer = await requireViewer();

  const sender = dmIdentityOf(viewer);
  if (!sender) {
    return { error: "Crie um personagem antes de enviar mensagens." };
  }
  if (sender.id === targetActorId) {
    return { error: "Uma identidade não abre conversa consigo mesma." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dm_start_direct", {
    sender_actor: sender.id,
    target_actor: targetActorId,
  });

  if (error || !data) return { error: describeMessageError(error?.message) };

  revalidatePath("/messages");
  return { conversationId: data };
}

export async function createGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();

  const parsed = groupSchema.safeParse({
    title: formData.get("title"),
    members: formData.getAll("members"),
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const sender = dmIdentityOf(viewer);
  if (!sender) {
    return { ok: false, message: "Crie um personagem antes de abrir conversas." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dm_create_group", {
    sender_actor: sender.id,
    group_title: parsed.data.title,
    members: parsed.data.members,
  });

  if (error) return { ok: false, message: describeMessageError(error.message) };

  revalidatePath("/messages");
  return { ok: true, conversationId: data };
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  await requireViewer();
  const supabase = await createClient();
  await supabase.rpc("dm_mark_read", { target: conversationId });
  revalidateMessages(conversationId);
}

/** Some da minha caixa. O histórico dos outros participantes continua lá. */
export async function hideConversationAction(conversationId: string): Promise<{ error?: string }> {
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("dm_hide", { target: conversationId });
  if (error) return { error: "Não foi possível ocultar a conversa." };
  revalidatePath("/messages");
  return {};
}

/** Apaga a conversa para todos os participantes. */
export async function clearConversationAction(conversationId: string): Promise<{ error?: string }> {
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("dm_clear", { target: conversationId });
  if (error) return { error: describeMessageError(error.message) };
  revalidateMessages(conversationId);
  return {};
}

/** A caixa e a conversa aberta dependem das duas. */
function revalidateMessages(conversationId: string) {
  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
}

function describeMessageError(message: string | undefined): string {
  if (!message) return "Não foi possível enviar agora.";

  // A recusa do RLS chega em inglês; o resto das funções já fala a língua da casa.
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "Você não participa dessa conversa.";
  }
  if (message.includes("dm_messages_conteudo") || message.includes("4000")) {
    return "A mensagem é longa demais.";
  }
  if (message.includes("duplicate key")) {
    return "Essa conversa já existe.";
  }
  if (message.includes("Participante não encontrado") || message.includes("Essa conta não existe")) {
    return "Alguém do convite não existe mais.";
  }
  return "Não foi possível enviar agora.";
}
