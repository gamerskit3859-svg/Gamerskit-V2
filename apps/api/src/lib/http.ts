import type { Response } from "express";

export function setPublicCache(res: Response, seconds: number, swr = seconds * 4) {
  res.set(
    "Cache-Control",
    `public, s-maxage=${seconds}, stale-while-revalidate=${swr}`,
  );
}

export function setPrivateNoStore(res: Response) {
  res.set("Cache-Control", "private, no-store");
}
