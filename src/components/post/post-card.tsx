import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { AccountTypeStamp, Handle } from "@/components/ui/account-type";
import { PostText } from "@/components/post/post-text";
import { PostMedia } from "@/components/post/post-media";
import { PostActions } from "@/components/post/post-actions";
import { accountTypeOf } from "@/lib/site";
import { relativeTime, fullTimestamp } from "@/lib/format/datetime";
import { cn } from "@/lib/cn";
import type { PostCard as PostCardData, ReplyContext } from "@/lib/types";

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
      {!hideContext && post.repliedTo ? (
        <>
          <RepliedPost repliedTo={post.repliedTo} detail={detail} />
          <p className="my-2 flex items-center gap-2 pl-12 text-xs text-ink-3">
            <span aria-hidden="true" className="h-4 w-px shrink-0 bg-line-2" />
            <span className="truncate">em resposta a</span>{" "}
            <Link
              href={`/profile/${post.repliedTo.author.username}`}
              className="truncate font-mono hover:text-ink hover:underline"
            >
              @{post.repliedTo.author.username}
            </Link>
          </p>
        </>
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

/**
 * O post citado, acima da resposta.
 *
 * Mesma pegada do Twitter: o original aparece completo mas compacto, sem
 * contadores e sem ações, e a linha vertical liga o avatar dele ao da resposta.
 */
function RepliedPost({ repliedTo, detail }: { repliedTo: ReplyContext; detail: boolean }) {
  const { post, author } = repliedTo;

  return (
    <div className="flex gap-3 opacity-90">
      <Link href={`/post/${post.id}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <Avatar
          name={author.display_name}
          username={author.username}
          src={author.avatar_url}
          size={detail ? "md" : "sm"}
          decorative
        />
      </Link>
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Link
            href={`/profile/${author.username}`}
            className="truncate text-sm font-medium text-ink hover:underline"
          >
            {author.display_name}
          </Link>
          <AccountTypeStamp type={accountTypeOf(author)} />
          <Handle username={author.username} size="xs" />
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
        </header>

        {post.content ? (
          <Link href={`/post/${post.id}`} className="block">
            <PostText
              content={post.content}
              className={cn("mt-1 line-clamp-3 text-ink-2", detail ? "text-[15px]" : "text-sm")}
            />
          </Link>
        ) : null}

        {post.media.length > 0 ? (
          <Link href={`/post/${post.id}`} className="block">
            <PostMedia media={post.media} className="mt-2 max-w-[18rem]" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
