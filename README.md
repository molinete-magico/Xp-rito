# twitter espiritual — a rede privada da mesa

Rede social privada para **um RPG** com um Mestre e um pequeno grupo de
jogadores. Personagens, NPCs e organizações publicam, respondem, curtem e se
seguem dentro de uma "cidade" fictícia.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Supabase**: Postgres (RLS), Auth, Storage e Realtime
- **Tailwind CSS 4** — design editorial "registro civil": papel quente, tinta
  escura, fios de 1px, Newsreader + Archivo + IBM Plex Mono
- **PGlite** para rodar as migrations e os testes de paridade localmente

## Estrutura principal

```
supabase/migrations/   schema, RLS, triggers, Storage e Realtime
src/app/               rotas (feed, perfil, hashtag, notificações, admin, auth)
src/components/        UI e blocos de interface
src/lib/               sessão, dados, mídia, validação, formatação
src/types/database.ts  tipos do banco gerados à mão + relacionamentos
scripts/smoke-db.mts   smoke do banco: migrations + RLS em PGlite
tests/                 paridade TS↔Postgres e runner de banco
```

## Rodando

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do projeto Supabase
npm run db:smoke             # aplica migrations num Postgres efêmero e valida RLS
npm run dev
```

A aplicação **não funciona sem Supabase**: a rede é fechada (autenticação e
RLS em tudo) e as variáveis públicas precisam existir. Os buckets de Storage
`avatars`, `banners` e `post-media` são criados pelas migrations de Storage.

## Checagens

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # paridade de username e hashtag com o banco
npm run db:smoke    # smoke de migrations + RLS
```

## Convite para a mesa

Cada jogador cria a própria conta. O Mestre atribui o papel `gm` no banco
(conceder o papel hoje é SQL no painel do Supabase) e usa `/admin` para criar
NPCs e organizações. Não há cadastro público: só entra quem tem conta.

## Notas de arquitetura

- O banco é a autoridade final de segurança; as ações validam formato e
  retornam mensagens úteis, mas nunca substituem as políticas de RLS.
- `actors` é um espelho de `characters`/`organizations`, sincronizado por
  triggers; clientes não escrevem nele.
- O banco guarda o caminho e a URL pública de mídias; o upload vai direto do
  navegador para o Storage, protegido por políticas por pasta de cada
  identidade.
- Conteúdo de posts é renderizado por segmentos React, nunca HTML bruto.