// src/api/controllers/fidelidade.controller.js
const { PrismaClient } = require("@prisma/client");
const { criarErro } = require("../middlewares/error.middleware");

const prisma = new PrismaClient();

async function consultarSaldo(req, res, next) {
  try {
    const pontos = await prisma.pontosFidelidade.findUnique({
      where: { clienteId: req.usuario.id },
    });
    if (!pontos) {
      return next(criarErro(404, "FIDELIDADE_NAO_ENCONTRADA",
        "Perfil de fidelidade nao encontrado. Faca um pedido para comecar a acumular pontos."));
    }
    return res.json({
      clienteId: req.usuario.id,
      saldo:     pontos.saldo,
      updatedAt: pontos.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { consultarSaldo };
