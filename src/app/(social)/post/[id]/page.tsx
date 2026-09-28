import { PostDetailStream } from "@/components/post/post-detail-stream";

/**
 * Página de uma publicação.
 *
 * Moldura pré-renderizada (botão voltar); a publicação, as respostas e o
 * compositor chegam no navegador com o mesmo RLS do servidor.
 */
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <PostDetailStream postId={id} />
    </>
  );
}