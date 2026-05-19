// src/infrastructure/logger/audit.logger.js
const winston = require("winston");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/audit.log" }),
  ],
});

/**
 * Registra acao sensivel no log e no banco de dados.
 * @param {string} acao   - Ex: PEDIDO_CRIADO, LOGIN, CANCELAMENTO
 * @param {string} recurso - Ex: pedidos, usuarios
 * @param {object} detalhe - Dados relevantes da acao
 * @param {string} usuarioId - ID do usuario que executou
 * @param {string} ip - IP da requisicao
 */
async function registrar(acao, recurso, detalhe = {}, usuarioId = null, ip = null) {
  logger.info({ acao, recurso, detalhe, usuarioId, ip });
  try {
    await prisma.auditLog.create({
      data: { acao, recurso, detalhe, usuarioId, ip },
    });
  } catch (err) {
    logger.error("Erro ao salvar audit log no banco", { err: err.message });
  }
}

module.exports = { registrar, logger };
