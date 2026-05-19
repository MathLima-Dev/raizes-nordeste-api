// src/api/controllers/estoque.controller.js
const { PrismaClient } = require("@prisma/client");
const { z } = require("zod");
const { criarErro } = require("../middlewares/error.middleware");
const { registrar } = require("../../infrastructure/logger/audit.logger");

const prisma = new PrismaClient();

const movimentoSchema = z.object({
  tipo:       z.enum(["ENTRADA", "SAIDA"]),
  quantidade: z.number().int().positive("Quantidade deve ser um inteiro positivo"),
  motivo:     z.string().optional(),
});

async function atualizar(req, res, next) {
  try {
    const { unidadeId, produtoId } = req.params;

    const parse = movimentoSchema.safeParse(req.body);
    if (!parse.success) {
      const details = parse.error.errors.map((e) => ({ field: e.path[0], issue: e.message }));
      return next(criarErro(422, "DADOS_INVALIDOS", "Dados invalidos.", details));
    }

    const { tipo, quantidade, motivo } = parse.data;

    const estoque = await prisma.estoqueUnidade.findUnique({
      where: { unidadeId_produtoId: { unidadeId, produtoId } },
    });

    if (!estoque) {
      return next(criarErro(404, "ESTOQUE_NAO_ENCONTRADO",
        "Produto nao encontrado nesta unidade."));
    }

    if (tipo === "SAIDA" && estoque.quantidadeDisponivel < quantidade) {
      return next(criarErro(409, "ESTOQUE_INSUFICIENTE",
        "Quantidade de saida maior que o estoque disponivel.",
        [{ field: "quantidade", issue: `Disponivel: ${estoque.quantidadeDisponivel}` }]));
    }

    const novaQtd = tipo === "ENTRADA"
      ? estoque.quantidadeDisponivel + quantidade
      : estoque.quantidadeDisponivel - quantidade;

    const atualizado = await prisma.estoqueUnidade.update({
      where: { unidadeId_produtoId: { unidadeId, produtoId } },
      data:  { quantidadeDisponivel: novaQtd },
    });

    await registrar("ESTOQUE_MOVIMENTADO", "estoque_unidades",
      { unidadeId, produtoId, tipo, quantidade, motivo, novaQtd },
      req.usuario?.id, req.ip);

    return res.json({
      unidadeId,
      produtoId,
      tipo,
      quantidade,
      quantidadeDisponivel: atualizado.quantidadeDisponivel,
      updatedAt: atualizado.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

async function consultar(req, res, next) {
  try {
    const { unidadeId, produtoId } = req.params;
    const estoque = await prisma.estoqueUnidade.findUnique({
      where: { unidadeId_produtoId: { unidadeId, produtoId } },
      include: { produto: { select: { nome: true } } },
    });
    if (!estoque) return next(criarErro(404, "ESTOQUE_NAO_ENCONTRADO", "Estoque nao encontrado."));
    return res.json({
      unidadeId,
      produtoId,
      nomeProduto:          estoque.produto.nome,
      quantidadeDisponivel: estoque.quantidadeDisponivel,
      updatedAt:            estoque.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { atualizar, consultar };
