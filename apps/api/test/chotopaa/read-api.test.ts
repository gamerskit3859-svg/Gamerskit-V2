import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { cachePurge } from "../../src/chotopaa/cache.js";
import { assertChotopaaDatabase, closeChotopaaDb } from "../../src/chotopaa/db.js";
import { DEFAULT_SIZE_CHART } from "../../src/chotopaa/attributes.js";

/**
 * The ChotoPaa read API (src/chotopaa) against its own throwaway database.
 * Field-for-field parity with ChotoPaa's backend is checked separately, by
 * chotopaa's deploy/read-api/compare-read-api.mjs against both servers.
 */

let mongo: MongoMemoryServer;
let server: Server;
let base: string;
let db: mongoose.mongo.Db;
let client: mongoose.mongo.MongoClient;

const oid = () => new mongoose.Types.ObjectId();
const ids = { cat: oid(), sub: oid(), brand: oid(), p1: oid(), p2: oid(), p3: oid() };

const get = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { headers });

async function seed() {
  await db.collection("categories").insertMany([
    { _id: ids.cat, name: "Sneakers", slug: "sneakers", isActive: true, parentCategory: null, createdAt: new Date(1) },
    { _id: ids.sub, name: "Kids Sneakers", slug: "kids-sneakers", isActive: true, parentCategory: ids.cat, createdAt: new Date(2) },
  ]);
  await db.collection("brands").insertOne({ _id: ids.brand, name: "Little Steps", slug: "little-steps", isActive: true });
  await db.collection("products").insertMany([
    {
      _id: ids.p1, title: "Cloud Runner", slug: "cloud-runner", isActive: true, isFeatured: true,
      category: ids.sub, brand: ids.brand, gender: "girl", priceFrom: 900, priceTo: 900,
      variants: [{ euSize: 24, stock: 3 }], createdAt: new Date(3),
    },
    {
      _id: ids.p2, title: "Puddle Boot", slug: "puddle-boot", isActive: true, category: ids.cat,
      gender: "unisex", priceFrom: 1500, priceTo: 1500, variants: [{ euSize: 25, stock: 0 }],
      sizeChart: [{ euSize: 25, ukSize: "8", footLengthCm: 15.7, ageGroup: "3-5y" }],
      createdAt: new Date(4),
    },
    { _id: ids.p3, title: "Hidden Shoe", slug: "hidden-shoe", isActive: false, category: ids.cat, createdAt: new Date(5) },
  ]);
  await db.collection("herobanners").insertOne({
    isPublished: true,
    slides: [
      { mediaUrl: "b", order: 2, isActive: true },
      { mediaUrl: "off", order: 0, isActive: false },
      { mediaUrl: "a", order: 1, isActive: true },
    ],
  });
  await db.collection("shopvideos").insertMany([
    { title: "On", isActive: true, order: 1, product: ids.p1, videoKey: "secret", posterKey: "secret" },
    { title: "Hidden product", isActive: true, order: 2, product: ids.p3 },
    { title: "Off", isActive: false, order: 0 },
  ]);
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  client = await mongoose.mongo.MongoClient.connect(mongo.getUri());
  db = client.db("chotopaa_test");
  process.env.CHOTOPAA_MONGODB_URI = mongo.getUri();
  process.env.CHOTOPAA_DB_NAME = "chotopaa_test";
  process.env.CHOTOPAA_PURGE_SECRET = "purge-secret";
  process.env.CHOTOPAA_CORS_ORIGINS = "https://chotopaa.com";
  process.env.CHOTOPAA_CACHE_TTL_SECONDS = "60";
  await seed();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/chotopaa/v1`;
});

beforeEach(() => {
  cachePurge();
});

afterAll(async () => {
  server?.close();
  await closeChotopaaDb();
  await client?.close();
  await mongo?.stop();
});

describe("products", () => {
  it("lists active products only, newest first, in ChotoPaa's envelope", async () => {
    const res = await get("/products");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe("Products fetched successfully");
    expect(body.data.map((p: { slug: string }) => p.slug)).toEqual(["puddle-boot", "cloud-runner"]);
    expect(body.meta).toEqual({ page: 1, limit: 12, total: 2, totalPage: 1, hasMore: false });
    expect(body.data[1].category).toEqual({ _id: String(ids.sub), name: "Kids Sneakers", slug: "kids-sneakers" });
  });

  it("filters a parent category including its children", async () => {
    const body = await (await get("/products?category=sneakers&sort=name")).json();
    expect(body.data.map((p: { slug: string }) => p.slug)).toEqual(["cloud-runner", "puddle-boot"]);
  });

  it("includes unisex shoes for ?gender=girl, and only in-stock sizes for ?size", async () => {
    const girl = await (await get("/products?gender=girl")).json();
    expect(girl.meta.total).toBe(2);
    const size = await (await get("/products?size=24,25")).json();
    expect(size.data.map((p: { slug: string }) => p.slug)).toEqual(["cloud-runner"]);
  });

  it("returns empty for an unknown category or brand", async () => {
    const body = await (await get("/products?category=nope")).json();
    expect(body).toMatchObject({ data: [], meta: { total: 0 } });
  });

  it("gives the same recommended order for the same seed", async () => {
    const a = await (await get("/products?sort=recommended&seed=42")).json();
    cachePurge();
    const b = await (await get("/products?sort=recommended&seed=42")).json();
    expect(a.data.map((p: { _id: string }) => p._id)).toEqual(b.data.map((p: { _id: string }) => p._id));
  });

  it("serves the home shelves", async () => {
    const body = await (await get("/products/featured")).json();
    expect(body.data.map((p: { slug: string }) => p.slug)).toEqual(["cloud-runner"]);
  });

  it("adds effectiveSizeChart: the product's own chart, else the store default", async () => {
    const own = await (await get("/products/puddle-boot")).json();
    expect(own.data.effectiveSizeChart).toEqual([
      { euSize: 25, ukSize: "8", footLengthCm: 15.7, ageGroup: "3-5y" },
    ]);
    const fallback = await (await get(`/products/${ids.p1}`)).json();
    expect(fallback.data.effectiveSizeChart).toHaveLength(DEFAULT_SIZE_CHART.length);
  });

  it("answers an unknown product with ChotoPaa's 404 envelope", async () => {
    const res = await get("/products/no-such-shoe");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      success: false,
      message: "Product not found.",
      error: { code: 404, description: "An unexpected error occurred. Please try again later." },
    });
  });
});

describe("other catalogue reads", () => {
  it("builds the category tree", async () => {
    const body = await (await get("/categories")).json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ slug: "sneakers", image: null, showOnLanding: false });
    expect(body.data[0].children[0]).toMatchObject({ slug: "kids-sneakers", children: [] });
  });

  it("answers a malformed id with 400, like ChotoPaa", async () => {
    const res = await get("/brands/not-an-id");
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Invalid _id: not-an-id");
  });

  it("fills settings defaults when no document exists, plus the server flags", async () => {
    const body = await (await get("/settings")).json();
    expect(body.data).toMatchObject({
      advanceRequired: true,
      deliveryCharge: 120,
      stockEnforcement: true,
      bkashNumber: "",
    });
    expect(body.data.sizeChart).toHaveLength(DEFAULT_SIZE_CHART.length);
  });

  it("shows only active hero slides, in order", async () => {
    const body = await (await get("/hero")).json();
    expect(body.data.slides.map((s: { mediaUrl: string }) => s.mediaUrl)).toEqual(["a", "b"]);
  });

  it("hides storage keys and hidden products on videos", async () => {
    const body = await (await get("/videos")).json();
    expect(body.data.map((v: { title: string }) => v.title)).toEqual(["On", "Hidden product"]);
    expect(body.data[0]).not.toHaveProperty("videoKey");
    expect(body.data[0].product.slug).toBe("cloud-runner");
    expect(body.data[1].product).toBeNull();
  });

  it("is read-only: writes don't exist", async () => {
    const res = await fetch(`${base}/products`, { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("cache", () => {
  it("serves a repeat request from memory", async () => {
    expect((await get("/brands")).headers.get("x-cache")).toBe("MISS");
    expect((await get("/brands")).headers.get("x-cache")).toBe("HIT");
  });

  it("is cleared by ChotoPaa's purge call, and only with the secret", async () => {
    await get("/brands");
    const purge = (token?: string) =>
      fetch(`${base}/cache/purge`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    expect((await purge()).status).toBe(401);
    expect((await purge("wrong")).status).toBe(401);
    expect((await get("/brands")).headers.get("x-cache")).toBe("HIT");
    const ok = await purge("purge-secret");
    expect(ok.status).toBe(200);
    expect((await get("/brands")).headers.get("x-cache")).toBe("MISS");
  });
});

describe("isolation from GamersKit", () => {
  it("allows ChotoPaa's storefront origin and nobody else", async () => {
    const ok = await get("/settings", { Origin: "https://chotopaa.com" });
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://chotopaa.com");
    const other = await get("/settings", { Origin: "https://evil.example" });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("doesn't open GamersKit's own routes to ChotoPaa's origin", async () => {
    const res = await fetch(`${base.replace("/api/chotopaa/v1", "")}/health`, {
      headers: { Origin: "https://chotopaa.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("refuses GamersKit's or Glowly's database", () => {
    expect(() => assertChotopaaDatabase("mongodb://h/", "gamerskitv2")).toThrow();
    expect(() => assertChotopaaDatabase("mongodb://h/glowly", "chotopaa")).toThrow();
    process.env.MONGODB_URI = "mongodb://u:p@cluster0.example.net/shop";
    expect(() => assertChotopaaDatabase("mongodb://r:q@cluster0.example.net/", "shop")).toThrow();
    expect(() => assertChotopaaDatabase("mongodb://r:q@other.example.net/", "chotopaa")).not.toThrow();
    delete process.env.MONGODB_URI;
  });
});
