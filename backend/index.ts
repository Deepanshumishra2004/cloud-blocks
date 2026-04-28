import express from "express";
import cors from "cors";
import { PORT, API, WEBHOOK } from "./config/config";
import apiRoutes from "./routes/routes";
import { handleStripeWebhook } from "./controller/webhook.controller";
import "./worker/cron";

const app = express();

app.use(`${API}${WEBHOOK}`,
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

app.use(cors({
  origin : process.env.FRONTEND_URL ?? "http://localhost:3000",
  credentials : true
}));

app.use(express.json());
app.use(`${API}`, apiRoutes);

app.get("/health",(req,res)=>{
  res.json({
    status : "ok"
  })
})

app.listen(PORT,()=>{
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API base: http://localhost:${PORT}${API}`);
})
