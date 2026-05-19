// src/infrastructure/mock/pagamento.mock.service.js
const env = require("../../config/env");

/**
 * Simula chamada a gateway de pagamento externo.
 * Em producao, aqui entraria a integracao real (Stripe, PagSeguro, etc).
 * PAYMENT_MOCK_MODE: RANDOM | APPROVE | REFUSE
 */
async function processarPagamentoMock({ pedidoId, total, formaPagamento, requestId }) {
  // Simula latencia de rede (200ms)
  await new Promise((r) => setTimeout(r, 200));

  let aprovado;
  if (env.PAYMENT_MOCK_MODE === "APPROVE") {
    aprovado = true;
  } else if (env.PAYMENT_MOCK_MODE === "REFUSE") {
    aprovado = false;
  } else {
    // RANDOM — 80% de aprovacao para simular ambiente real
    aprovado = Math.random() < 0.8;
  }

  if (aprovado) {
    return {
      status: "APROVADO",
      payload: {
        autorizacao: `AUTH-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        bandeira: formaPagamento === "CARTAO_CREDITO" || formaPagamento === "CARTAO_DEBITO"
          ? "VISA"
          : null,
        processadoEm: new Date().toISOString(),
      },
    };
  } else {
    return {
      status: "RECUSADO",
      payload: {
        motivo: "Saldo insuficiente ou limite excedido",
        processadoEm: new Date().toISOString(),
      },
    };
  }
}

module.exports = { processarPagamentoMock };
