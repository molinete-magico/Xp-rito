"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { createPostSchema, editPostSchema, replySchema, fieldErrors, type ActionState } from "@/lib/validation/schemas";

/**
 * Publicações e interações.
 *
 * A publicação inteira vai por `public.publish_post`: post e anexos na mesma
 * transação, para que não exista no feed uma publicação sem a imagem escolhida.
 * As regras de escrita são sempre do banco: se o actor não pertence à pessoa, o
 * RLS recusa dentro da função e a Action reporta o erro. Aqui se valida formato
 * (limites, campos), nunca autorização.
 */

type MediaPayload = {
  storagePath: string;
  mediaType: string;
  width: number | null;
  height: number | null;
  altText: string;
};

export async function createPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();

  const parsed = createPostSchema.safeParse({
    actorId: formData.get("actorId"),
    content: formData.get("content"),
    replyTo: formData.get("replyTo") || null,
    repostOf: formData.get("repostOf") || null,
    media: parseMediaField(formData.get("media")),
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_post", {
    p_actor_id: parsed.data.actorId,
    p_content: parsed.data.content,
    p_reply_to: parsed.data.replyTo,
    p_repost_of: parsed.data.repostOf,
    p_media: parsed.data.media,
  });

  if (error) return { ok: false, message: describePostError(error.message) };

  revalidateFeed();
  return { ok: true };
}

export async function replyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();

  const parsed = replySchema.safeParse({
    actorId: formData.get("actorId"),
    postId: formData.get("postId"),
    content: formData.get("content"),
    media: parseMediaField(formData.get("media")),
  });

  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_post", {
    p_actor_id: parsed.data.actorId,
    p_content: parsed.data.content,
    p_reply_to: parsed.data.postId,
    p_repost_of: null,
    p_media: parsed.data.media,
  });

  if (error) return { ok: false, message: describePostError(error.message) };

  revalidatePath(`/post/${parsed.data.postId}`);
  revalidateFeed();
  return { ok: true };
}

export async function updatePostAction(postId: string, content: string): Promise<{ ok: boolean; error?: string }> {
  await requireViewer();

  const parsed = editPostSchema.safeParse({ postId, content });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Texto inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("posts")
    .update({ content: parsed.data.content })
    .eq("id", parsed.data.postId);

  if (error) return { ok: false, error: describePostError(error.message) };

  revalidatePath(`/post/${parsed.data.postId}`);
  revalidateFeed();
  return { ok: true };
}

export async function toggleLikeAction(postId: string): Promise<{ liked: boolean } | { error: string }> {
  const viewer = await requireViewer();
  const actorId = viewer.activeActorId;
  if (!actorId) return { error: "Nenhuma identidade disponível." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("actor_id", actorId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("likes").delete().eq("post_id", postId).eq("actor_id", actorId);
    if (error) return { error: "Não foi possível remover a curtida." };
    revalidateFeed();
    return { liked: false };
  }

  const { error } = await supabase.from("likes").insert({ post_id: postId, actor_id: actorId });
  if (error) return { error: "Não foi possível curtir." };
  revalidateFeed();
  return { liked: true };
}

export async function toggleRepostAction(postId: string): Promise<{ reposted: boolean } | { error: string }> {
  const viewer = await requireViewer();
  const actorId = viewer.activeActorId;
  if (!actorId) return { error: "Nenhuma identidade disponível." };

  const supabase = await createClient();

  // Repostar um repost é recusado pelo banco; aqui apenas evitamos a ida-e-volta.
  const { data: target } = await supabase
    .from("posts")
    .select("repost_of")
    .eq("id", postId)
    .maybeSingle();

  if (!target) return { error: "Publicação não encontrada." };
  if (target.repost_of) return { error: "Não é possível repostar um repost." };

  const { data: existing } = await supabase
    .from("posts")
    .select("id")
    .eq("repost_of", postId)
    .eq("actor_id", actorId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("posts").delete().eq("id", existing.id);
    if (error) return { error: "Não foi possível desfazer o repost." };
    revalidateFeed();
    return { reposted: false };
  }

  const { error } = await supabase
    .from("posts")
    .insert({ actor_id: actorId, repost_of: postId })
    .select("id")
    .single();

  if (error) return { error: "Não foi possível repostar." };
  revalidateFeed();
  return { reposted: true };
}

export async function toggleFollowAction(targetActorId: string): Promise<
  { following: boolean } | { error: string }
> {
  const viewer = await requireViewer();
  const actorId = viewer.activeActorId;
  if (!actorId) return { error: "Nenhuma identidade disponível." };
  if (actorId === targetActorId) return { error: "Uma identidade não segue a si mesma." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", actorId)
    .eq("following_id", targetActorId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", actorId)
      .eq("following_id", targetActorId);
    if (error) return { error: "Não foi possível deixar de seguir." };
    revalidatePath(`/profile/${await usernameOf(supabase, targetActorId)}`);
    revalidateFeed();
    return { following: false };
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: actorId, following_id: targetActorId });

  if (error) return { error: "Não foi possível seguir." };

  revalidatePath(`/profile/${await usernameOf(supabase, targetActorId)}`);
  revalidateFeed();
  return { following: true };
}

export async function deletePostAction(postId: string): Promise<{ error?: string }> {
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) return { error: "Não foi possível apagar a publicação." };
  revalidateFeed();
  return {};
}

async function usernameOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
): Promise<string> {
  const { data } = await supabase.from("actors").select("username").eq("id", actorId).maybeSingle();
  return data?.username ?? "";
}

/** O feed, o perfil e as notificações dependem de posts; invalidamos os três. */
function revalidateFeed() {
  revalidatePath("/home");
  revalidatePath("/explore");
  revalidatePath("/notifications");
}

function parseMediaField(raw: FormDataEntryValue | null): MediaPayload[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const value = item as Record<string, unknown>;
      if (typeof value.storagePath !== "string") return [];
      return [
        {
          storagePath: value.storagePath,
          mediaType: String(value.mediaType ?? "image/jpeg"),
          width: typeof value.width === "number" ? value.width : null,
          height: typeof value.height === "number" ? value.height : null,
          altText: typeof value.altText === "string" ? value.altText : "",
        },
      ];
    });
  } catch {
    return [];
  }
}

function describePostError(message: string | undefined): string {
  if (!message) return "Não foi possível publicar.";

  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "Você só publica como as suas próprias identidades.";
  }
  if (message.includes("posts_has_content_or_media") || message.includes("texto ou de imagem")) {
    return "A publicação precisa de texto ou de imagem.";
  }
  if (message.includes("post_media_repost_not_allowed") || message.includes("repost não pode")) {
    return "Um repost não pode ter imagem própria.";
  }
  if (message.includes("posts_content_len") || message.includes("1000")) {
    return "O limite é 1000 caracteres.";
  }
  if (message.includes("posts_reply_xor_repost")) {
    return "Uma publicação não é resposta e repost ao mesmo tempo.";
  }
  return "Não foi possível publicar agora.";
}
