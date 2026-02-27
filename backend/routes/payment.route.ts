import { Router } from "express";
import { CREATE_CHECKOUT_SESSION, CREATE_SUBSCRIPTION } from "../config";
import { createCheckout } from "../controller/payment.controller";

const paymentRoutes = Router();

paymentRoutes.post(`${CREATE_CHECKOUT_SESSION}`, createCheckout);

export default paymentRoutes;