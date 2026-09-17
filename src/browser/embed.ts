/**
 * Deciding whether a third-party page can be shown in the Browser window's
 * iframe. Headers (X-Frame-Options, CSP frame-ancestors) are not readable
 * cross-origin, so three signals are combined: a list of hosts known to
 * refuse embedding, a load timeout, and the iframe's `load` event. Pure.
 */
import { hostOf } from "./address";

/** Hosts (and their subdomains) that refuse to be framed. Shown as a card right away. */
export const BLOCKED_HOSTS: readonly string[] = [
  "google.com",
  "accounts.google.com",
  "youtube.com",
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "stackoverflow.com",
  "npmjs.com",
  "vercel.com",
  "netlify.com",
  "cloudflare.com",
  "figma.com",
  "notion.so",
  "slack.com",
  "discord.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "reddit.com",
  "medium.com",
  "amazon.com",
  "apple.com",
  "microsoft.com",
  "login.microsoftonline.com",
  "openai.com",
  "chatgpt.com",
  "anthropic.com",
  "claude.ai",
  "paypal.com",
  "stripe.com",
];

export const EMBED_TIMEOUT_MS = 8000;

export function isBlockedHost(url: string, list = BLOCKED_HOSTS): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return list.some((h) => host === h || host.endsWith(`.${h}`));
}

export type EmbedState = "loading" | "loaded" | "refused";

export interface EmbedSignals {
  url: string;
  /** When the iframe got its src (ms). */
  startedAt: number;
  /** Now (ms). */
  now: number;
  /** The iframe fired `load`. */
  loaded: boolean;
  /** The user asked to try a listed host anyway. */
  force?: boolean;
  timeoutMs?: number;
  blocked?: readonly string[];
}

/**
 * The state to show for an external page. Listed hosts are refused unless
 * forced; a `load` event counts as loaded (Chromium fires it even for a
 * blocked frame, which is why the list exists); silence past the timeout
 * counts as refused.
 */
export function judgeEmbed(s: EmbedSignals): EmbedState {
  if (!s.force && isBlockedHost(s.url, s.blocked)) return "refused";
  if (s.loaded) return "loaded";
  return s.now - s.startedAt >= (s.timeoutMs ?? EMBED_TIMEOUT_MS)
    ? "refused"
    : "loading";
}

export const REFUSED_MESSAGE =
  "This site refuses to be embedded. Open it in a new tab, or connect the local agent bridge to browse it there.";
