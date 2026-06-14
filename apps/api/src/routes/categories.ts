import { Router } from "express";
import { CategoryModel } from "../models/Category.js";
import { ProductModel } from "../models/Product.js";
import { adminRequired } from "../lib/auth.js";
import { setPrivateNoStore } from "../lib/http.js";

const router = Router();
const PUBLIC_CATEGORY_FIELDS =
  "slug name description image icon parentId featured order active productCount createdAt updatedAt";

type CategoryTreeNode = {
  _id: { toString(): string };
  slug?: string;
  productCount?: number;
  parentId?: { toString(): string } | string | null;
  subcategories: CategoryTreeNode[];
  [key: string]: unknown;
};

type CategoryRecord = Record<string, unknown> & {
  _id: { toString(): string };
  slug?: string;
  productCount?: number;
};

async function withLiveProductCounts(categories: CategoryRecord[]): Promise<CategoryRecord[]> {
  if (categories.length === 0) return categories;

  const ids = categories.map((cat) => cat._id);
  const slugs = categories
    .map((cat) => cat.slug)
    .filter((slug): slug is string => Boolean(slug));

  const [byId, bySlug] = await Promise.all([
    ProductModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { category: { $in: ids } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
    ProductModel.aggregate<{ _id: string; count: number }>([
      { $match: { categorySlug: { $in: slugs } } },
      { $group: { _id: "$categorySlug", count: { $sum: 1 } } },
    ]),
  ]);

  const countById = new Map(byId.map((row) => [String(row._id), row.count]));
  const countBySlug = new Map(bySlug.map((row) => [String(row._id), row.count]));

  return categories.map((cat) => ({
    ...cat,
    productCount: Math.max(
      Number(cat.productCount) || 0,
      countById.get(String(cat._id)) ?? 0,
      cat.slug ? countBySlug.get(cat.slug) ?? 0 : 0,
    ),
  }));
}

function rollupProductCounts(nodes: CategoryTreeNode[]): number {
  return nodes.reduce((sum, node) => {
    const childCount = rollupProductCounts(node.subcategories);
    const directCount = Number(node.productCount) || 0;
    node.productCount = directCount + childCount;
    return sum + node.productCount;
  }, 0);
}

function buildCategoryTree(categories: Array<Record<string, unknown>>): CategoryTreeNode[] {
  const categoryMap = new Map<string, CategoryTreeNode>();
  const rootCategories: CategoryTreeNode[] = [];

  categories.forEach((cat) => {
    const id = String(cat._id);
    categoryMap.set(id, { ...cat, subcategories: [] } as unknown as CategoryTreeNode);
  });

  categories.forEach((cat) => {
    const id = String(cat._id);
    const node = categoryMap.get(id);
    if (!node) return;

    const parentId = cat.parentId ? String(cat.parentId) : "";
    const parent = parentId && parentId !== id ? categoryMap.get(parentId) : null;

    if (parent) {
      parent.subcategories.push(node);
    } else {
      rootCategories.push(node);
    }
  });

  rollupProductCounts(rootCategories);
  return rootCategories;
}

// Get all categories with subcategories
router.get("/", async (req, res) => {
  try {
    const categories = await CategoryModel.find({ active: true })
      .sort({ parentId: 1, order: 1, name: 1 })
      .select(PUBLIC_CATEGORY_FIELDS)
      .lean();

    setPrivateNoStore(res);
    const countedCategories = await withLiveProductCounts(categories as CategoryRecord[]);
    res.json({ items: buildCategoryTree(countedCategories) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Admin: get all categories with subcategories, including inactive categories.
router.get("/admin/all", adminRequired, async (_req, res) => {
  try {
    setPrivateNoStore(res);
    const categories = await CategoryModel.find({})
      .sort({ parentId: 1, order: 1, name: 1 })
      .select(PUBLIC_CATEGORY_FIELDS)
      .lean();

    const countedCategories = await withLiveProductCounts(categories as CategoryRecord[]);
    res.json({ items: buildCategoryTree(countedCategories) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get category by slug or ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let category = null;

    // First try to find by slug (more common case)
    category = await CategoryModel.findOne({ slug: id })
      .select(PUBLIC_CATEGORY_FIELDS)
      .lean();

    // If not found, try to find by ObjectId (only if it looks like a valid MongoDB ID)
    if (!category && id.match(/^[0-9a-fA-F]{24}$/)) {
      try {
        category = await CategoryModel.findOne({ _id: id })
          .select(PUBLIC_CATEGORY_FIELDS)
          .lean();
      } catch {
        // Ignore cast errors
      }
    }

    if (!category) {
      res.status(404).json({ error: "not found" });
      return;
    }

    // Get subcategories if this is a parent category
    const subcategories = await CategoryModel.find({
      parentId: category._id,
      active: true,
    })
      .sort({ order: 1, name: 1 })
      .select(PUBLIC_CATEGORY_FIELDS)
      .lean();

    setPrivateNoStore(res);
    res.json({ item: { ...category, subcategories } });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Create category (admin only)
router.post("/", adminRequired, async (req, res) => {
  try {
    const { slug, name, description, image, icon, parentId, order, featured } = req.body;

    if (!slug || !name) {
      res.status(400).json({ error: "slug and name are required" });
      return;
    }

    if (parentId) {
      const parent = await CategoryModel.findById(parentId).select("_id").lean();
      if (!parent) {
        res.status(400).json({ error: "Parent category not found." });
        return;
      }
    }

    const category = await CategoryModel.create({
      slug,
      name,
      description,
      image,
      icon,
      parentId: parentId || null,
      order: order || 0,
      featured: featured || false,
      active: true,
    });

    res.status(201).json({ item: category });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Update category (admin only)
router.patch("/:id", adminRequired, async (req, res) => {
  try {
    const { slug, name, description, image, icon, parentId, order, active, featured } = req.body;

    if (parentId && parentId === req.params.id) {
      res.status(400).json({ error: "Category cannot be its own parent." });
      return;
    }

    if (parentId) {
      const categories = await CategoryModel.find({})
        .select("_id parentId")
        .lean();
      const childMap = new Map<string, string[]>();
      categories.forEach((cat) => {
        if (!cat.parentId) return;
        const key = String(cat.parentId);
        childMap.set(key, [...(childMap.get(key) || []), String(cat._id)]);
      });
      const stack = [...(childMap.get(String(req.params.id)) || [])];
      const descendants = new Set<string>();
      while (stack.length > 0) {
        const id = stack.pop();
        if (!id || descendants.has(id)) continue;
        descendants.add(id);
        stack.push(...(childMap.get(id) || []));
      }
      if (descendants.has(String(parentId))) {
        res.status(400).json({ error: "Category cannot be moved under its own child." });
        return;
      }
    }

    const category = await CategoryModel.findByIdAndUpdate(
      req.params.id,
      {
        ...(slug && { slug }),
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(image !== undefined && { image }),
        ...(icon !== undefined && { icon }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(order !== undefined && { order }),
        ...(active !== undefined && { active }),
        ...(featured !== undefined && { featured }),
      },
      { new: true },
    ).lean();

    if (!category) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.json({ item: category });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Delete category (admin only)
router.delete("/:id", adminRequired, async (req, res) => {
  try {
    // Check if category has products
    const productCount = await ProductModel.countDocuments({
      category: req.params.id,
    });

    if (productCount > 0) {
      res.status(400).json({
        error: `Cannot delete category with ${productCount} product(s). Please reassign or delete products first.`,
      });
      return;
    }

    // Check if category has subcategories
    const subcategoryCount = await CategoryModel.countDocuments({
      parentId: req.params.id,
    });

    if (subcategoryCount > 0) {
      res.status(400).json({
        error: `Cannot delete category with ${subcategoryCount} subcategory(ies). Please delete or reassign them first.`,
      });
      return;
    }

    await CategoryModel.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
