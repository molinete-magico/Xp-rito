import Image from "next/image";
import { Settings } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { AccountTypeStamp, Handle } from "@/components/ui/account-type";
import { FollowButton, Stat } from "@/components/profile/follow-button";
import { ButtonLink } from "@/components/ui/button";
import { accountTypeOf } from "@/lib/site";
import type { ActorProfile } from "@/lib/types";

/**
 * Cabeçalho de perfil.
 *
 * A capa é uma faixa de papel com a imagem no canto superior direito. O @handle
 * fica em mono, logo abaixo do nome, por ser identificação e não decoração.
 */
export function ProfileHeader({
  profile,
  typeLabel,
}: {
  profile: ActorProfile;
  typeLabel: string;
}) {
  const initials = profile.display_name.slice(0, 1).toUpperCase();
  const banner = profile.banner_url ?? profile.entity.banner_url;

  return (
    <header>
      <div className="paper-banner relative h-32 overflow-hidden border-b border-line sm:h-40">
        {banner ? (
          <Image
            src={banner}
            alt=""
            fill
            sizes="(min-width: 1024px) 640px, 100vw"
            className="object-cover object-right-top opacity-90"
          />
        ) : null}
        <span
          aria-hidden="true"
          className="absolute top-4 left-5 font-mono text-4xl leading-none text-ink/15 select-none sm:text-5xl"
        >
          {initials}
        </span>
      </div>

      <div className="px-4 pb-3">
        <div className="relative z-10 -mt-10 flex items-end justify-between gap-3 sm:-mt-12">
          <Avatar
            name={profile.display_name}
            username={profile.username}
            src={profile.avatar_url}
            size="xl"
            className="border-2 border-surface"
          />

          <div className="flex items-center gap-2 pb-1">
            {profile.viewer.canEdit ? (
              <ButtonLink
                href={`/settings?identity=${profile.id}`}
                variant="outline"
                size="sm"
              >
                <Settings aria-hidden="true" className="h-3.5 w-3.5" />
                Editar
              </ButtonLink>
            ) : null}

            {profile.viewer.isSelf ? null : (
              <FollowButton
                targetActorId={profile.id}
                initialFollowing={profile.viewer.isFollowing}
                initialFollowers={profile.stats.followers}
              />
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl leading-tight text-ink sm:text-2xl">
              {profile.display_name}
            </h1>
            <AccountTypeStamp type={accountTypeOf(profile)} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <Handle username={profile.username} size="md" />
            <span className="text-xs text-ink-3">{typeLabel}</span>
          </div>

          {profile.bio ? (
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed whitespace-pre-line text-ink-2">
              {profile.bio}
            </p>
          ) : null}

          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <Stat value={profile.stats.posts} label="publicações" />
            <Stat value={profile.stats.followers} label="seguidores" />
            <Stat value={profile.stats.following} label="seguindo" />
            <Stat value={profile.stats.likesReceived} label="curtidas" />
          </dl>
        </div>
      </div>
    </header>
  );
}
