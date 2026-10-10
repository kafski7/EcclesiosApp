import type { FeedItem } from "@ecclesios/shared";
import { EpisodeCard, NewsCard, PostCard, TeachingCard } from "@/components/cards";

/** One blended-feed entry (D-033) — each type uses its card from the shared family (D-043). */
export function FeedItemCard({ item }: { item: FeedItem }) {
  switch (item.type) {
    case "POST":
      return <PostCard p={item.post} />;
    case "TEACHING":
      return <TeachingCard t={item.teaching} at={item.at} fresh level={3} />;
    case "NEWS":
      return <NewsCard n={item.news} at={item.at} level={3} />;
    case "EPISODE":
      return <EpisodeCard e={item.episode} at={item.at} />;
  }
}
