// src/config/swagger.js
const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Raizes do Nordeste API",
      version: "1.0.0",
      description:
        "API REST Back-End da Rede Raizes do Nordeste — Projeto Multidisciplinar UNINTER 2026. " +
        "Suporta multiplos canais (APP, TOTEM, BALCAO, PICKUP, WEB), controle de estoque por unidade, " +
        "pagamento mock e programa de fidelizacao em conformidade com a LGPD.",
    },
    servers: [{ url: "http://localhost:3000", description: "Servidor local de desenvolvimento" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Erropadrao: {
          type: "object",
          properties: {
            error:     { type: "string", example: "NOME_DO_ERRO" },
            message:   { type: "string", example: "Mensagem legivel" },
            details:   { type: "array", items: { type: "object" } },
            timestamp: { type: "string", example: "2026-05-18T12:00:00Z" },
            path:      { type: "string", example: "/pedidos" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/api/routes/*.js"],
};

module.exports = swaggerJsdoc(options);
