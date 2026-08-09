import { notFound, redirect } from "next/navigation";

import { currentHousehold, weddingBySlug } from "@/lib/guest";

import { Claim } from "./claim";

/**
 * The identity screen. Guests reach it by tapping something that writes without
 * having come through an invite link; anyone who already has a session is sent
 * straight on, so it never gets in the way twice.
 */
export default async function WhoScreen({ params, searchParams }: PageProps<"/[slug]/who">) {
  const { slug } = await params;
  const { next } = await searchParams;

  const wedding = await weddingBySlug(slug);
  if (!wedding) notFound();

  // Only ever redirect within this wedding — `next` comes from the URL.
  const target = typeof next === "string" && next.startsWith(`/${slug}`) ? next : `/${slug}/rsvp`;

  const household = await currentHousehold(wedding.id);
  if (household) redirect(target);

  return <Claim slug={slug} next={target} />;
}
