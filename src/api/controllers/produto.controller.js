// src/api/controllers/produto.controller.js
const { PrismaClient } = require("@prisma/client");
const { criarErro } = require("../middlewares/error.middleware");

const prisma = new PrismaClient();

async function listar(req, res, next) {
  try {
    const { unidadeId, categoria, page = "1", limit = "10" } = req.query;

    if (!unidadeId) {
      return next(criarErro(400, "PARAMETRO_OBRIGATORIO",
        "O parametro unidadeId e obrigatorio.",
        [{ field: "unidadeId", issue: "Campo obrigatorio" }]));
    }

    const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
    if (!unidade || !unidade.ativa) {
      return next(criarErro(404, "UNIDADE_NAO_ENCONTRADA", "Unidade nao encontrada ou inativa."));
    }

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const where = {
      produto: { ativo: true, ...(categoria ? { categoria } : {}) },
      unidadeId,
    };

    const [estoques, total] = await Promise.all([
      prisma.estoqueUnidade.findMany({
        where,
        include: { produto: true },
        skip,
        take: limitNum,
      }),
      prisma.estoqueUnidade.count({ where }),
    ]);

    const data = estoques.map((e) => ({
      id:          e.produto.id,
      nome:        e.produto.nome,
      descricao:   e.produto.descricao,
      preco:       Number(e.produto.preco),
      categoria:   e.produto.categoria,
      sazonal:     e.produto.sazonal,
      disponivel:  e.quantidadeDisponivel > 0,
      estoque:     e.quantidadeDisponivel,
    }));

    return res.json({ data, total, page: pageNum, limit: limitNum });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar };
