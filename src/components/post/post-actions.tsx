"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Share2,
  Trash2,
} from "lucide-react";
import { toggleLikeAction, toggleRepostAction, deletePostAction } from "@/app/actions/posts";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import type { PostStats, ViewerInteraction } from "@/lib/types";

/**
 * Ações de uma publicação.
 *
 * Otimista de propósito: curtir e repostar são de leitura-imediata, e esperar o
 * servidor para pintar o ícone trava a interface. O estado real chega pela
 * revalidação; se a chamada falhar, revertemos e mostramos o motivo, para não
 * exibir um coração aceso que o banco não confirmou.
 */
export function PostActions({
  postId,
  stats,
  viewer,
  username,
}: {
  postId: string;
  stats: PostStats;
  viewer: ViewerInteraction;
  username: string;
}) {
  const [liked, setLiked] = useState(viewer.liked);
  const [reposted, setReposted] = useState(viewer.reposted);
  const [likeCount, setLikeCount] = useState(stats.likes);
  const [repostCount, setRepostCount] = useState(stats.reposts);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A revalidação devolve os números do banco. Sincronizar aqui segue o padrão
  // "ajustar estado quando uma prop muda": compara com o último valor recebido e
  // só reescreve quando muda de verdade, sem efeito.
  const [server, setServer] = useState({
    liked: viewer.liked,
    reposted: viewer.reposted,
    likes: stats.likes,
    reposts: stats.reposts,
  });
  if (
    server.liked !== viewer.liked ||
    server.reposted !== viewer.reposted ||
    server.likes !== stats.likes ||
    server.reposts !== stats.reposts
  ) {
    setServer({
      liked: viewer.liked,
      reposted: viewer.reposted,
      likes: stats.likes,
      reposts: stats.reposts,
    });
    setLiked(viewer.liked);
    setReposted(viewer.reposted);
    setLikeCount(stats.likes);
    setRepostCount(stats.reposts);
  }

  function onLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((value) => value + (next ? 1 : -1));
    setError(null);

    startTransition(async () => {
      const result = await toggleLikeAction(postId);
      if ("error" in result) {
        setLiked(!next);
        setLikeCount((value) => value + (next ? -1 : 1));
        setError(result.error);
      }
    });
  }

  function onRepost() {
    const next = !reposted;
    setReposted(next);
    setRepostCount((value) => value + (next ? 1 : -1));
    setError(null);

    startTransition(async () => {
      const result = await toggleRepostAction(postId);
      if ("error" in result) {
        setReposted(!next);
        setRepostCount((value) => value + (next ? -1 : 1));
        setError(result.error);
      }
    });
  }

  async function onCopy() {
    const url = `${window.location.origin}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("O navegador não deixou copiar o endereço.");
    }
  }

  return (
    <div className="mt-3 flex items-center gap-1">
      <ActionLink href={`/post/${postId}`} label="Responder" count={stats.replies}>
        <MessageCircle aria-hidden="true" />
      </ActionLink>

      <ActionButton
        label={reposted ? "Desfazer repost" : "Repostar"}
        count={repostCount}
        active={reposted}
        onClick={onRepost}
        disabled={pending}
      >
        <Repeat2 aria-hidden="true" />
      </ActionButton>

      <ActionButton
        label={liked ? "Remover curtida" : "Curtir"}
        count={likeCount}
        active={liked}
        onClick={onLike}
        disabled={pending}
        activeClassName="text-danger"
      >
        <Heart aria-hidden="true" className={cn(liked && "fill-current")} />
      </ActionButton>

      <ActionButton label="Copiar endereço" onClick={onCopy}>
        {copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
      </ActionButton>

      {viewer.canDelete ? (
        <Menu
          label="Opções da publicação"
          align="end"
          className="ml-auto"
          trigger={(props) => (
            <button
              {...props}
              type="button"
              aria-label="Mais opções"
              className="flex h-8 w-8 items-center justify-center rounded-xs text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
            >
              <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem onSelect={onCopy}>
                <Copy aria-hidden="true" className="h-4 w-4" />
                Copiar endereço
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                destructive
                onSelect={() => {
                  close();
                  if (!confirm("Apagar esta publicação? As respostas também vão junto.")) return;
                  startTransition(async () => {
                    const result = await deletePostAction(postId);
                    if (result.error) setError(result.error);
                  });
                }}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Apagar publicação
              </MenuItem>
            </>
          )}
        </Menu>
      ) : null}

      {error ? (
        <p role="alert" className="ml-auto text-xs text-danger">
          {error}
        </p>
      ) : null}

      <span className="sr-only">
        Post de {username} com {stats.replies} respostas, {repostCount} reposts e {likeCount} curtidas.
      </span>
    </div>
  );
}

function ActionButton({
  label,
  count,
  active,
  activeClassName,
  onClick,
  disabled,
  children,
}: {
  label: string;
  count?: number;
  active?: boolean;
  activeClassName?: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-xs px-2 text-xs text-ink-3 transition-colors hover:bg-sunken hover:text-ink-2 disabled:opacity-50",
        active && activeClassName,
      )}
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{children}</span>
      {typeof count === "number" && count > 0 ? <span className="tabular-nums">{count}</span> : null}
    </button>
  );
}

function ActionLink({
  href,
  label,
  count,
  children,
}: {
  href: string;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex h-8 items-center gap-1.5 rounded-xs px-2 text-xs text-ink-3 transition-colors hover:bg-sunken hover:text-ink-2"
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{children}</span>
      {typeof count === "number" && count > 0 ? <span className="tabular-nums">{count}</span> : null}
    </Link>
  );
}

/** Indicador de revalidação em curso, discreto. */
export function PendingMark({ pending }: { pending: boolean }) {
  if (!pending) return null;
  return <Loader2 aria-label="Salvando" className="h-3.5 w-3.5 animate-spin text-ink-3" />;
}
