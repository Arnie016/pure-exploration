import {explorers,type ExplorerEnv} from './explorers';
import {skylineBilling,type SkylineEnv} from './skyline-billing';
import {owner} from './private';
import { activity } from "./activity";
/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env extends SkylineEnv, ExplorerEnv {
  ASSETS: Fetcher;
  DB: D1Database;
  OWNER_KEY_HASH?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/explorers") return explorers(request,env);
    if (url.pathname.startsWith("/api/skyline/")) return skylineBilling(request,env);
    if (url.pathname.startsWith("/api/admin/")) return owner(request, env.DB, env.OWNER_KEY_HASH);
    if (["/api/pulse", "/api/event", "/api/stats", "/api/favorite", "/api/garden", "/api/profile", "/api/signal", "/api/forget", "/api/reaction", "/api/feedback"].includes(url.pathname)) return activity(request, env.DB);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
