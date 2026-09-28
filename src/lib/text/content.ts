/**
 * Segmentação de texto para renderização.
 *
 * O conteúdo de uma publicação é SEMPRE tratado como texto não confiável: nunca
 * há `dangerouslySetInnerHTML` no caminho. O texto é quebrado em segmentos e
 * renderizado como elementos React, o que elimina XSS por construção e ainda
 * permite transformar hashtags e links em elementos focáveis e acessíveis.
 *
 * A regra de hashtag é a mesma de `public.extract_hashtags` no Postgres, e a
 * paridade é verificada em `tests/hashtag-parity.test.ts`.
 */

/** Blocos Unicode aceitos em hashtags: Latim estendido, Grego, Cirílico. */
const HASHTAG_BODY = "A-Za-z0-9_\\u00C0-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF";
const NOT_BEFORE_HASHTAG = "A-Za-z0-9_#\\u00C0-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF";

export const HASHTAG_PATTERN = new RegExp(
  `(^|[^${NOT_BEFORE_HASHTAG}])#([${HASHTAG_BODY}]{1,50})`,
  "g",
);

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

export type Segment =
  | { kind: "text"; value: string }
  | { kind: "hashtag"; value: string }
  | { kind: "link"; value: string; href: string };

/** Hashtags normalizadas e sem repetição, na ordem da primeira aparição. */
export function extractHashtags(text: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    const tag = match[2]?.toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }
  return result;
}

type Mark = { start: number; end: number; segment: Segment };

/**
 * Quebra o texto em segmentos. Um caractere separador entre dois marcadores
 * não é perdido: ele é devolvido como texto antes do marcador seguinte.
 */
export function segmentContent(text: string): Segment[] {
  const marks: Mark[] = [];

  for (const match of text.matchAll(URL_PATTERN)) {
    const value = trimUrlTail(match[0]);
    if (value) marks.push({ start: match.index, end: match.index + value.length, segment: { kind: "link", value, href: value } });
  }

  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    const tag = match[2];
    if (!tag) continue;
    // O grupo 1 é o caractere anterior: a hashtag começa no '#'.
    const start = match.index + match[0].indexOf("#");
    marks.push({ start, end: start + tag.length + 1, segment: { kind: "hashtag", value: tag } });
  }

  if (marks.length === 0) return [{ kind: "text", value: text }];

  marks.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const mark of marks) {
    if (mark.start < cursor) continue; // sobreposição (hashtag dentro de URL)
    if (mark.start > cursor) {
      segments.push({ kind: "text", value: text.slice(cursor, mark.start) });
    }
    segments.push(mark.segment);
    cursor = mark.end;
  }

  if (cursor < text.length) {
    segments.push({ kind: "text", value: text.slice(cursor) });
  }

  return segments;
}

/** Pontuação colada ao final de uma URL quase sempre pertence à frase. */
function trimUrlTail(raw: string): string {
  return raw.replace(/[.,;:!?)\]}]+$/, "");
}

/** "@arthurvalenca" → "arthurvalenca" para montar a rota de perfil. */
export function profilePath(username: string): string {
  return `/profile/${encodeURIComponent(username)}`;
}

export function hashtagPath(name: string): string {
  return `/hashtag/${encodeURIComponent(name.toLowerCase())}`;
}
