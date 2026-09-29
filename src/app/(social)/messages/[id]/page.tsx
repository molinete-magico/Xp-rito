import { ConversationStream } from "@/components/messages/conversation-stream";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConversationStream conversationId={id} />;
}
