import { Router } from "express";
import { CREATE_CHECKOUT_SESSION, CREATE_SUBSCRIPTION } from "../config/config";
import { createCheckout } from "../controller/payment.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const paymentRoutes = Router();


paymentRoutes.post("/checkout", authMiddleware, createCheckout);

export default paymentRoutes;