import { Router } from "express";
import { CREATE_CHECKOUT_SESSION, CREATE_SUBSCRIPTION } from "../config/config";
import { createCheckout } from "../controller/payment.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { paymentLimiter } from "../middleware/rateLimiters";

const paymentRoutes = Router();

paymentRoutes.post("/checkout", paymentLimiter, authMiddleware, createCheckout);

export default paymentRoutes;