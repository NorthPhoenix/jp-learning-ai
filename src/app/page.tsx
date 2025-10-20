import { HydrateClient } from "~/trpc/server";
import ConversationPage from "~/components/conversation-page"

export default async function Home() {
  return (
    <HydrateClient>
      <ConversationPage />
    </HydrateClient>
  );
}