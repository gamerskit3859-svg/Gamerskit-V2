import type { Response } from "express";

export function setPrivateNoStore(res: Response) {
  res.set("Cache-Control", "private, no-store");
}
