import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { AccountTypeStamp, Handle } from "@/components/ui/account-type";
import { PostText } from "@/components/post/post-text";
import { PostMedia } from "@/components/post/post-media";
import { PostActions } from "@/components/post/post-actions";
import { accountTypeOf } from "@/lib/site";
import { relativeTime, fullTimestamp } from "@/lib/format/datetime";
import { cn } from "@/lib/cn";
import type { PostCard as PostCardData } from "@/lib/types";

/**
 * Uma publicação.
 *
 * O mesmo componente serve feed, perfil, hashtag e página de post. A diferença
 * entre "card" e "post" aqui é só a moldura: no feed a publicação é um item de
 * lista (com borda inferior, sem URL no clique inteiro); na página do post ela
 * tem o texto maior e o link visível.
 */
export function PostCard({
  post,
  variant = "card",
  hideContext = false,
}: {
  post: PostCardData;
  variant?: "card" | "detail";
  hideContext?: boolean;
}) {
  const detail = variant === "detail";
  const authorType = accountTypeOf(post.author);

  if (post.reposted) {
    return (
      <article className={cn("px-4 py-3", detail ? "" : "border-b border-line")}>
        <div className="flex gap-3">
          <Avatar
            name={post.author.display_name}
            username={post.author.username}
            src={post.author.avatar_url}
            size={detail ? "md" : "sm"}
            decorative
            className="mt-1"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">
              <Link
                href={`/profile/${post.author.username}`}
                className="font-medium text-ink hover:underline"
              >
                {post.author.display_name}
              </Link>{" "}
              <span className="text-ink-3">repostou</span>
            </p>
            <PostCard post={post.reposted.post} variant={variant} hideContext />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn("px-4", detail ? "pt-3 pb-2" : "border-b border-line py-3")}
      aria-labelledby={`post-author-${post.id}`}
    >
      {!hideContext && post.replyContext ? (
        <p className="mb-1 flex items-center gap-2 pl-12 text-xs text-ink-3">
          <span aria-hidden="true" className="h-px w-8 bg-line-2" />
          em resposta a{" "}
          <Link
            href={`/profile/${post.replyContext.username}`}
            className="font-mono hover:text-ink hover:underline"
          >
            @{post.replyContext.username}
          </Link>
        </p>
      ) : null}

      <div className="flex gap-3">
        <Link href={`/profile/${post.author.username}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
          <Avatar
            name={post.author.display_name}
            username={post.author.username}
            src={post.author.avatar_url}
            size={detail ? "md" : "sm"}
          />
        </Link>

        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              id={`post-author-${post.id}`}
              href={`/profile/${post.author.username}`}
              className="truncate text-sm font-medium text-ink hover:underline"
            >
              {post.author.display_name}
            </Link>
            <AccountTypeStamp type={authorType} />
            <Handle username={post.author.username} size="xs" />
            <span aria-hidden="true" className="text-ink-3">
              ·
            </span>
            <time
              dateTime={post.created_at}
              title={fullTimestamp(post.created_at)}
              className="text-xs text-ink-3"
            >
              {relativeTime(post.created_at)}
            </time>
            {post.edited ? (
              <span className="text-xs text-ink-3" title="Editada após a publicação">
                editada
              </span>
            ) : null}
          </header>

          {post.content ? (
            <PostText content={post.content} className={detail ? "mt-1.5 text-[15px]" : "mt-1"} />
          ) : null}

          <PostMedia media={post.media} />

          <PostActions
            postId={post.id}
            stats={post.stats}
            viewer={post.viewer}
            username={post.author.username}
          />
        </div>
      </div>
    </article>
  );
}
