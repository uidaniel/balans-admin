"use client";

import Image from "next/image";
import { useState } from "react";
import { Pill, btn } from "@/components/ui";
import { Icon } from "@/components/icons";
import { X_LIMIT, slidePath, xLength, type Platform, type Post } from "@/lib/content";
import { zip } from "@/lib/zip";

/*
 * One day's post, ready to go out: the artwork, the caption for each
 * platform, and a pack per platform — the images that platform takes, in
 * order, with its caption — so posting is download, upload, paste.
 */

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "x", label: "X" },
];

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PostPanel({ post }: { post: Post }) {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [copied, setCopied] = useState(false);
  const [packing, setPacking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const all = Array.from({ length: post.slides }, (_, i) => i + 1);
  const used = platform === "x" ? (post.x.slides ?? all.slice(0, 4)) : all;
  const caption = platform === "x" ? post.x.caption : post.instagram.caption;
  const count = platform === "x" ? xLength(caption) : caption.length;
  const over = platform === "x" && count > X_LIMIT;
  const base = `balans-${post.id}`;

  async function copy() {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function pack() {
    setPacking(true);
    setFailed(null);
    try {
      const images = await Promise.all(
        used.map(async (n, i) => {
          const res = await fetch(slidePath(post, n));
          if (!res.ok) throw new Error(`slide ${n} is missing (${res.status})`);
          return { name: `${String(i + 1).padStart(2, "0")}.jpg`, data: new Uint8Array(await res.arrayBuffer()) };
        }),
      );
      const text = { name: `caption-${platform}.txt`, data: new TextEncoder().encode(caption) };
      save(zip([...images, text]), `${base}-${platform}.zip`);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    } finally {
      setPacking(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="ink">{post.kind}</Pill>
        <Pill>
          {post.slides} {post.slides === 1 ? "image" : "images"}
        </Pill>
        <h3 className="w-full text-[1.15rem] leading-snug font-medium tracking-[-0.015em]">{post.title}</h3>
      </div>

      {/* The artwork. On X, the slides it leaves out are dimmed. */}
      <div className="scroll-x flex snap-x gap-3 overflow-x-auto pb-1">
        {all.map((n) => {
          const on = used.includes(n);
          return (
            <figure key={n} className={`w-40 shrink-0 snap-start transition-opacity sm:w-44 ${on ? "" : "opacity-35"}`}>
              <a href={slidePath(post, n)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-line bg-canvas">
                <Image
                  src={slidePath(post, n)}
                  alt={`${post.title}, image ${n}`}
                  width={1080}
                  height={1350}
                  unoptimized
                  className="aspect-[4/5] h-auto w-full object-cover"
                />
              </a>
              <figcaption className="mt-1.5 flex items-center justify-between text-xs text-ink/50">
                <span>
                  {n} of {post.slides}
                </span>
                <a
                  href={slidePath(post, n)}
                  download={`${base}-${n}.jpg`}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-ink/65 hover:bg-canvas hover:text-ink"
                >
                  <Icon name="download" className="size-3.5" />
                  Save
                </a>
              </figcaption>
            </figure>
          );
        })}
      </div>

      {post.note && (
        <p className="flex gap-2 rounded-2xl bg-marigold/10 px-3.5 py-2.5 text-[0.85rem] leading-relaxed text-ink/75">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-marigold-ink" />
          {post.note}
        </p>
      )}

      <div>
        <div role="tablist" aria-label="Platform" className="inline-flex rounded-full border border-line bg-canvas p-1">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={platform === p.id}
              onClick={() => setPlatform(p.id)}
              className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${
                platform === p.id ? "bg-white text-ink shadow-card" : "text-ink/55 hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-2xl border border-line bg-paper">
          <pre className="max-h-80 overflow-y-auto px-4 py-3.5 font-sans text-[0.9rem] leading-relaxed whitespace-pre-wrap text-ink/85">
            {caption}
          </pre>
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-ink/50">
            <span className={over ? "font-medium text-clay" : ""}>
              {count}
              {platform === "x" && ` / ${X_LIMIT}`} characters
            </span>
            <span>
              {platform === "x" && post.slides > 4
                ? `Images ${used.join(", ")}`
                : `${used.length} ${used.length === 1 ? "image" : "images"}`}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={pack} disabled={packing} className={btn.accent}>
            <Icon name="download" className="size-4" />
            {packing ? "Packing…" : `Download ${platform === "x" ? "X" : "Instagram"} pack`}
          </button>
          <button type="button" onClick={copy} className={btn.secondary}>
            <Icon name={copied ? "check" : "file"} className="size-4" />
            {copied ? "Copied" : "Copy caption"}
          </button>
          <button
            type="button"
            onClick={() => save(new Blob([caption], { type: "text/plain;charset=utf-8" }), `${base}-${platform}.txt`)}
            className={btn.secondary}
          >
            <Icon name="download" className="size-4" />
            Caption .txt
          </button>
        </div>
        {failed && <p className="mt-2 text-sm text-clay">Could not build the pack: {failed}</p>}
      </div>
    </div>
  );
}
