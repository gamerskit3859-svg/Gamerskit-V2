import { Router } from "express";
import heroRouter from "./hero.js";
import demoVideosRouter from "./demo-videos.js";

const router = Router();

router.use("/hero", heroRouter);
router.use("/demo-videos", demoVideosRouter);

export default router;
