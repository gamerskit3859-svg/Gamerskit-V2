import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { adminRequired } from "../lib/auth.js";
import { setPrivateNoStore } from "../lib/http.js";
import { OrderModel } from "../models/Order.js";
import {
  mapGamersKitOrderToSteadfast,
  steadfastService,
  SteadfastApiError,
  type SteadfastCreateOrderPayload,
  type SteadfastJson,
  type SteadfastOrderLike,
} from "../services/steadfast.service.js";

const router = Router();

router.use(adminRequired);
router.use((_req, res, next) => {
  setPrivateNoStore(res);
  next();
});

const createOrderSchema = z.object({
  invoice: z.string().min(1),
  recipient_name: z.string().min(1),
  recipient_phone: z.string().min(5),
  alternative_phone: z.string().optional(),
  recipient_email: z.string().email().optional().or(z.literal("")),
  recipient_address: z.string().min(2),
  cod_amount: z.number().min(0),
  note: z.string().optional(),
  item_description: z.string().optional(),
  total_lot: z.number().int().min(1).optional(),
  delivery_type: z.union([z.literal(0), z.literal(1)]).optional(),
});

const bulkOrderSchema = z.object({
  data: z.array(createOrderSchema).min(1).optional(),
  orders: z.array(createOrderSchema).min(1).optional(),
});

const bulkGamersKitOrderSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(500),
});

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  const nested = getRecord(value)[key];
  if (typeof nested !== "object" || nested === null) return null;
  const record = nested as Record<string, unknown>;
  return Object.keys(record).length > 0 ? record : null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function extractCourierFields(response: SteadfastJson): {
  consignmentId?: string;
  trackingCode?: string;
  status?: string;
} {
  const root = getRecord(response);
  const candidate =
    nestedRecord(response, "consignment") ??
    nestedRecord(response, "data") ??
    nestedRecord(response, "result") ??
    root;

  return {
    consignmentId: pickString(candidate, [
      "consignment_id",
      "consignmentId",
      "consignmentID",
      "cid",
      "id",
    ]),
    trackingCode: pickString(candidate, [
      "tracking_code",
      "trackingCode",
      "tracking_number",
      "trackingNumber",
    ]),
    status: pickString(candidate, ["status", "delivery_status"]),
  };
}

function sendSteadfastError(res: Response, err: unknown) {
  if (err instanceof SteadfastApiError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  res.status(500).json({ error: (err as Error).message || "Steadfast request failed" });
}

router.post("/orders/:id/create", async (req, res) => {
  try {
    const order = await OrderModel.findById(req.params.id).lean();
    if (!order) {
      res.status(404).json({ error: "order not found" });
      return;
    }

    const payload = mapGamersKitOrderToSteadfast(order as SteadfastOrderLike);
    const result = await steadfastService.createOrder(payload);
    const courierFields = extractCourierFields(result);
    const now = new Date();

    const updated = await OrderModel.findByIdAndUpdate(
      req.params.id,
      {
        courier: {
          provider: "steadfast",
          invoice: payload.invoice,
          consignmentId: courierFields.consignmentId,
          trackingCode: courierFields.trackingCode,
          status: courierFields.status,
          response: result,
          createdAt: now,
          updatedAt: now,
        },
      },
      { new: true },
    ).lean();

    res.status(201).json({ item: result, order: updated });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

router.post("/orders/bulk-create", async (req, res) => {
  const parsed = bulkGamersKitOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const orders = await OrderModel.find({ _id: { $in: parsed.data.orderIds } }).lean();
    if (orders.length === 0) {
      res.status(404).json({ error: "orders not found" });
      return;
    }
    const payloads = orders.map((order) =>
      mapGamersKitOrderToSteadfast(order as SteadfastOrderLike),
    );
    const result = await steadfastService.bulkCreateOrder(payloads);
    res.status(201).json({ item: result, count: payloads.length });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

router.post("/create-order", async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const result = await steadfastService.createOrder(
      parsed.data as SteadfastCreateOrderPayload,
    );
    res.status(201).json({ item: result });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

router.post("/bulk-create-order", async (req, res) => {
  const parsed = bulkOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const payloads = (parsed.data.data ?? parsed.data.orders) as SteadfastCreateOrderPayload[];
    const result = await steadfastService.bulkCreateOrder(payloads);
    res.status(201).json({ item: result, count: payloads.length });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

router.get("/status/consignment/:id", async (req, res) => {
  try {
    res.json({ item: await steadfastService.getStatusByConsignmentId(req.params.id) });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

router.get("/status/invoice/:invoice", async (req, res) => {
  try {
    res.json({ item: await steadfastService.getStatusByInvoice(req.params.invoice) });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

router.get("/status/tracking/:code", async (req, res) => {
  try {
    res.json({ item: await steadfastService.getStatusByTrackingCode(req.params.code) });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

router.get("/balance", async (_req, res) => {
  try {
    res.json({ item: await steadfastService.getBalance() });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

router.post("/return-requests", async (req, res) => {
  try {
    res.status(201).json({ item: await steadfastService.createReturnRequest(req.body) });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

router.get("/return-requests", async (req, res) => {
  try {
    res.json({ item: await steadfastService.getReturnRequests(req.query) });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

router.get("/return-requests/:id", async (req, res) => {
  try {
    res.json({ item: await steadfastService.getReturnRequest(req.params.id) });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

router.get("/payments", async (req, res) => {
  try {
    res.json({ item: await steadfastService.getPayments(req.query) });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

router.get("/payments/:id", async (req, res) => {
  try {
    res.json({ item: await steadfastService.getPaymentById(req.params.id) });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

router.get("/police-stations", async (req, res) => {
  try {
    res.json({ item: await steadfastService.getPoliceStations(req.query) });
  } catch (err) {
    sendSteadfastError(res, err);
  }
});

export default router;
