// src/app.js
require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const swaggerUi    = require("swagger-ui-express");
const swaggerSpec  = require("./config/swagger");
const routes       = require("./api/routes/index");
const { errorMiddleware } = require("./api/middlewares/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Rotas principais
app.use("/", routes);

// 404
app.use((req, res) => {
  res.status(404).json({
    error: "ROTA_NAO_ENCONTRADA",
    message: `Rota ${req.method} ${req.originalUrl} nao encontrada.`,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
});

// Handler global de erros
app.use(errorMiddleware);

module.exports = app;
