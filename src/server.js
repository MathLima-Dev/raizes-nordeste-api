// src/server.js
const app = require("./app");
const env = require("./config/env");
const { logger } = require("./infrastructure/logger/audit.logger");
const fs = require("fs");

// Criar pasta de logs se nao existir
if (!fs.existsSync("logs")) fs.mkdirSync("logs");

app.listen(env.PORT, () => {
  logger.info(`Servidor rodando em http://localhost:${env.PORT}`);
  logger.info(`Swagger disponivel em http://localhost:${env.PORT}/api-docs`);
  logger.info(`Ambiente: ${env.NODE_ENV}`);
});
