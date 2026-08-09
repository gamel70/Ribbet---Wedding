import { notFound } from "next/navigation";

import { resolveSections } from "@/lib/design";
import { currentHousehold, weddingBySlug } from "@/lib/guest";
import { householdPhotos } from "@/lib/vault";

import { Eyebrow, IdentifyPrompt, Lede, Panel, ScreenTitle } from "../ui";
import { VaultUploader } from "./uploader";

/** Screen 04 — Photos. The guest sees only their own uploads; the couple sees all. */
export default async function PhotosScreen({ params }: PageProps<"/[slug]/photos">) {
  const { slug } = await params;
  const wedding = await weddingBySlug(slug);
  if (!wedding) notFound();
  if (!resolveSections(wedding.sections).photos) notFound();

  const household = await currentHousehold(wedding.id);
  const mine = household ? await householdPhotos(household.id) : [];
  const names = [wedding.nameOne, wedding.nameTwo].filter(Boolean).join(" & ");

  return (
    <>
      <ScreenTitle>Photos</ScreenTitle>
      <Lede>
        Everything you add goes straight to {names || "the couple"}&apos;s private vault — their Google Drive, not a
        public feed. This is your record of what you&apos;ve sent.
      </Lede>

      <Panel style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 26,
            height: 26,
            flex: "none",
            border: "1px solid var(--acc)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: "var(--acc)",
          }}
        >
          ✓
        </span>
        <span style={{ fontSize: 12, lineHeight: 1.45, color: "var(--mut)" }}>
          Vault only — the couple sees every upload; guests never see each other&apos;s.
        </span>
      </Panel>

      <Eyebrow style={{ marginTop: 16 }}>Your uploads · {mine.length}</Eyebrow>

      {mine.length ? (
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
          {mine.map((photo) => (
            <div
              key={photo.id}
              style={{
                aspectRatio: "1",
                background: "linear-gradient(125deg, var(--panel) 40%, var(--line))",
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/vault/${slug}/thumb/${photo.id}`}
                alt=""
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            marginTop: 10,
            padding: "22px 16px",
            border: "1px dashed var(--line)",
            borderRadius: "var(--rad)",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "var(--mut)",
            textAlign: "center",
          }}
        >
          Nothing yet. Anything you send lands in the couple&apos;s Drive at full resolution — we never shrink it.
        </div>
      )}

      {household ? (
        <VaultUploader slug={slug} />
      ) : (
        <IdentifyPrompt slug={slug} next={`/${slug}/photos`} what="Every photo you send" />
      )}

      <div style={{ marginTop: 12, fontSize: 11, lineHeight: 1.6, color: "var(--mut)" }}>
        Originals only — nothing is compressed on the way in. Uploads keep going in the background, and anything you
        send with no signal waits on your phone and sends itself when you&apos;re back on.
      </div>
    </>
  );
}
