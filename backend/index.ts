import express from "express";
import cors from "cors";
import { PORT, API, WEBHOOK } from "./config";
import apiRoutes from "./routes/routes";
import { handleStripeWebhook } from "./controller/webhook.controller";
import "./worker/cron";

const app = express();

app.use(`${API}${WEBHOOK}`,
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

app.use(cors());
app.use(express.json());
app.use(`${API}`, apiRoutes);

app.listen(PORT,()=>{
    console.log(`listening to ${PORT}`)
})