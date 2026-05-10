import { Router } from "express";
import { CategoryModel } from "../models/Category.js";
import { ProductModel } from "../models/Product.js";
import { adminRequired } from "../lib/auth.js";

const router = Router();

// Get all categories with subcategories
router.get("/", async (req, res) => {
  try {
    const categories = await CategoryModel.find({ active: true })
      .sort({ parentId: 1, order: 1, name: 1 })
      .lean();

    // Structure categories with their subcategories
    const categoryMap = new Map();
    const rootCategories: any[] = [];

    categories.forEach((cat) => {
      const catData = { ...cat, subcategories: [] };
      categoryMap.set(cat._id.toString(), catData);

      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId.toString());
        if (parent) {
          parent.subcategories.push(catData);
        }
      } else {
        rootCategories.push(catData);
      }
    });

    res.json({ items: rootCategories });
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
    category = await CategoryModel.findOne({ slug: id }).lean();

    // If not found, try to find by ObjectId (only if it looks like a valid MongoDB ID)
    if (!category && id.match(/^[0-9a-fA-F]{24}$/)) {
      try {
        category = await CategoryModel.findOne({ _id: id }).lean();
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
      .lean();

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
