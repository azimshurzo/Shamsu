import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import workflowRoutes from "./routes/workflows";
import apiRoutes from "./routes/apis";
import executionRoutes from "./routes/execution";
import paymentRoutes from "./routes/payments";
import adminRoutes from "./routes/admin";
import aiRoutes from "./routes/ai";

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/apis", apiRoutes);
app.use("/api/execution", executionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Shamsu backend running on port ${PORT}`);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
