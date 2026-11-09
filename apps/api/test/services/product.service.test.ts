import { beforeEach, describe, expect, it } from "vitest";
import { useTestDb } from "../helpers/db.js";
import { CategoryModel } from "../../src/models/Category.js";
import { ProductModel } from "../../src/models/Product.js";
import {
  getLowStockProducts,
  getProductDetail,
  searchProducts,
} from "../../src/services/product.service.js";

useTestDb();

beforeEach(async () => {
  const mice = await CategoryModel.create({ slug: "mice", name: "Mice" });
  await ProductModel.create([
    { slug: "logitech-g102-lightsync", title: "Logitech G102 Lightsync", category: mice._id, price: 2600, stock: 5 },
    { slug: "logitech-g102", title: "Logitech G102", category: mice._id, price: 2300, compareAtPrice: 2100, stock: 1 },
    { slug: "razer-viper", title: "Razer Viper", category: mice._id, price: 5000, stock: 0, isActive: false },
    {
      slug: "gk-mousepad",
      title: "GamersKit Mousepad",
      category: mice._id,
      price: 800,
      stock: 3,
      variants: [{ name: "Size", options: [{ value: "L", stock: 2, sku: "PAD-L" }, { value: "XL", stock: 1, sku: "PAD-XL" }] }],
    },
  ]);
});

describe("searchProducts", () => {
  it("matches every word, partial words included, exact title first", async () => {
    const result = await searchProducts("logitech g10", { limit: 10 });
    expect(result.total).toBe(2);
    const exact = await searchProducts("Logitech G102", { limit: 10 });
    expect(exact.items.map((p) => p.title)).toEqual(["Logitech G102", "Logitech G102 Lightsync"]);
  });

  it("reports discount and effective price", async () => {
    const { items } = await searchProducts("Logitech G102", { limit: 1 });
    expect(items[0]).toMatchObject({ price: 2300, discountPrice: 2100, effectivePrice: 2100, category: "Mice" });
  });

  it("finds variant SKUs and computes variant stock", async () => {
    const { items } = await searchProducts("pad-xl", { limit: 5 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "GamersKit Mousepad", hasVariants: true, stock: 3 });
  });

  it("treats regex characters literally", async () => {
    expect((await searchProducts(".*", { limit: 5 })).total).toBe(0);
  });
});

describe("getProductDetail", () => {
  it("loads by slug or id and returns null when missing", async () => {
    const bySlug = await getProductDetail("gk-mousepad");
    expect(bySlug?.variants[0].options).toEqual([
      { value: "L", stock: 2, price: null, sku: "PAD-L" },
      { value: "XL", stock: 1, price: null, sku: "PAD-XL" },
    ]);
    expect((await getProductDetail(bySlug!.id))?.title).toBe("GamersKit Mousepad");
    expect(await getProductDetail("no-such-product")).toBeNull();
  });
});

describe("getLowStockProducts", () => {
  it("uses stock ≤ threshold, lowest first, active only by default", async () => {
    const result = await getLowStockProducts({ threshold: 3, limit: 20, includeInactive: false });
    expect(result.items.map((p) => [p.title, p.stock])).toEqual([
      ["Logitech G102", 1],
      ["GamersKit Mousepad", 3],
    ]);
    expect(result.outOfStock).toBe(0);
  });

  it("includes hidden products when asked", async () => {
    const result = await getLowStockProducts({ threshold: 3, limit: 20, includeInactive: true });
    expect(result.total).toBe(3);
    expect(result.outOfStock).toBe(1);
    expect(result.items[0]).toMatchObject({ title: "Razer Viper", isActive: false });
  });
});
