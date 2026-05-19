// src/api/controllers/pedido.controller.js
const { PrismaClient } = require("@prisma/client");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const { criarErro } = require("../middlewares/error.middleware");
const { registrar } = require("../../infrastructure/logger/audit.logger");
const { processarPagamentoMock } = require("../../infrastructure/mock/pagamento.mock.service");

const prisma = new PrismaClient();

// Transicoes validas de status
const TRANSICOES_VALIDAS = {
  AGUARDANDO_PAGAMENTO: ["EM_PREPARO", "CANCELADO"],
  EM_PREPARO:           ["PRONTO",     "CANCELADO"],
  PRONTO:               ["ENTREGUE"],
  ENTREGUE:             [],
  CANCELADO:            [],
};

const itemSchema = z.object({
  produtoId:  z.string().uuid("produtoId deve ser um UUID valido"),
  quantidade: z.number().int().positive("Quantidade deve ser inteiro positivo"),
});

const criarPedidoSchema = z.object({
  canalPedido:    z.enum(["APP","TOTEM","BALCAO","PICKUP","WEB"], {
    required_error: "canalPedido e obrigatorio",
    invalid_type_error: "canalPedido invalido. Valores aceitos: APP, TOTEM, BALCAO, PICKUP, WEB",
  }),
  unidadeId:      z.string().uuid("unidadeId deve ser um UUID valido"),
  itens:          z.array(itemSchema).min(1, "O pedido deve ter ao menos 1 item"),
  formaPagamento: z.enum(["PIX","CARTAO_CREDITO","CARTAO_DEBITO","MOCK"]).default("MOCK"),
});

const atualizarStatusSchema = z.object({
  status: z.enum(["EM_PREPARO","PRONTO","ENTREGUE","CANCELADO"]),
});

// ── Criar Pedido (Fluxo Critico) ──────────────────────────────────────────────
async function criar(req, res, next) {
  try {
    const parse = criarPedidoSchema.safeParse(req.body);
    if (!parse.success) {
      const details = parse.error.errors.map((e) => ({ field: e.path.join("."), issue: e.message }));
      return next(criarErro(400, "DADOS_INVALIDOS", "Dados do pedido invalidos.", details));
    }

    const { canalPedido, unidadeId, itens, formaPagamento } = parse.data;
    const clienteId = req.usuario.id;

    // Verificar unidade
    const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
    if (!unidade || !unidade.ativa) {
      return next(criarErro(404, "UNIDADE_NAO_ENCONTRADA", "Unidade nao encontrada ou inativa."));
    }

    // Verificar produtos e estoque
    const produtosComEstoque = [];
    const errosEstoque = [];

    for (const item of itens) {
      const estoque = await prisma.estoqueUnidade.findUnique({
        where: { unidadeId_produtoId: { unidadeId, produtoId: item.produtoId } },
        include: { produto: true },
      });

      if (!estoque || !estoque.produto.ativo) {
        return next(criarErro(404, "PRODUTO_NAO_ENCONTRADO",
          `Produto ${item.produtoId} nao encontrado nesta unidade.`));
      }

      if (estoque.quantidadeDisponivel < item.quantidade) {
        errosEstoque.push({
          field: `itens[produtoId:${item.produtoId}].quantidade`,
          issue: `Disponivel: ${estoque.quantidadeDisponivel}, solicitado: ${item.quantidade}`,
        });
      }

      produtosComEstoque.push({ ...item, produto: estoque.produto, estoque });
    }

    if (errosEstoque.length > 0) {
      return next(criarErro(409, "ESTOQUE_INSUFICIENTE",
        "Nao ha quantidade suficiente para um ou mais itens.", errosEstoque));
    }

    // Calcular total
    const total = produtosComEstoque.reduce(
      (acc, item) => acc + Number(item.produto.preco) * item.quantidade, 0
    );

    // Criar pedido no banco
    const pedido = await prisma.pedido.create({
      data: {
        clienteId,
        unidadeId,
        canalPedido,
        status: "AGUARDANDO_PAGAMENTO",
        total,
        itens: {
          create: produtosComEstoque.map((item) => ({
            produtoId:    item.produtoId,
            quantidade:   item.quantidade,
            precoUnitario: Number(item.produto.preco),
          })),
        },
      },
      include: { itens: { include: { produto: { select: { nome: true } } } } },
    });

    await registrar("PEDIDO_CRIADO", "pedidos",
      { pedidoId: pedido.id, canalPedido, total, itensCount: itens.length },
      clienteId, req.ip);

    // Processar pagamento mock
    const requestId = uuidv4();
    const resultadoPagamento = await processarPagamentoMock({
      pedidoId: pedido.id, total, formaPagamento, requestId,
    });

    // Salvar pagamento
    await prisma.pagamento.create({
      data: {
        pedidoId:      pedido.id,
        status:        resultadoPagamento.status,
        formaPagamento,
        requestId,
        payload:       resultadoPagamento.payload,
      },
    });

    // Atualizar status do pedido conforme resultado do pagamento
    let novoStatus = "AGUARDANDO_PAGAMENTO";
    if (resultadoPagamento.status === "APROVADO") {
      novoStatus = "EM_PREPARO";

      // Decrementar estoque
      for (const item of produtosComEstoque) {
        await prisma.estoqueUnidade.update({
          where: { unidadeId_produtoId: { unidadeId, produtoId: item.produtoId } },
          data:  { quantidadeDisponivel: { decrement: item.quantidade } },
        });
      }

      // Creditar pontos de fidelidade (1 ponto por real gasto)
      const pontos = Math.floor(total);
      await prisma.pontosFidelidade.upsert({
        where:  { clienteId },
        update: { saldo: { increment: pontos } },
        create: { clienteId, saldo: pontos },
      });

      await registrar("PAGAMENTO_APROVADO", "pagamentos",
        { pedidoId: pedido.id, requestId, total }, clienteId, req.ip);
    } else {
      await registrar("PAGAMENTO_RECUSADO", "pagamentos",
        { pedidoId: pedido.id, requestId, motivo: resultadoPagamento.payload?.motivo },
        clienteId, req.ip);
    }

    await prisma.pedido.update({ where: { id: pedido.id }, data: { status: novoStatus } });

    return res.status(201).json({
      pedidoId:    pedido.id,
      status:      novoStatus,
      canalPedido,
      total:       Number(total.toFixed(2)),
      pagamento: {
        status:  resultadoPagamento.status,
        payload: resultadoPagamento.payload,
      },
      itens: pedido.itens.map((i) => ({
        produtoId:    i.produtoId,
        nome:         i.produto.nome,
        quantidade:   i.quantidade,
        precoUnitario: Number(i.precoUnitario),
      })),
      createdAt: pedido.createdAt,
    });
  } catch (err) {
    next(err);
  }
}

// ── Listar Pedidos ────────────────────────────────────────────────────────────
async function listar(req, res, next) {
  try {
    const { canalPedido, status, unidadeId, page = "1", limit = "10" } = req.query;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    // CLIENTE so ve seus proprios pedidos
    const where = {};
    if (req.usuario.perfil === "CLIENTE") where.clienteId = req.usuario.id;
    if (canalPedido) where.canalPedido = canalPedido;
    if (status)      where.status      = status;
    if (unidadeId)   where.unidadeId   = unidadeId;

    const [pedidos, total] = await Promise.all([
      prisma.pedido.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        include: { itens: { include: { produto: { select: { nome: true } } } } },
      }),
      prisma.pedido.count({ where }),
    ]);

    return res.json({
      data: pedidos.map((p) => ({
        pedidoId:   p.id,
        status:     p.status,
        canalPedido: p.canalPedido,
        total:      Number(p.total),
        itensCount: p.itens.length,
        createdAt:  p.createdAt,
      })),
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    next(err);
  }
}

// ── Buscar Pedido por ID ──────────────────────────────────────────────────────
async function buscarPorId(req, res, next) {
  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id: req.params.id },
      include: {
        itens:    { include: { produto: { select: { nome: true, preco: true } } } },
        pagamento: true,
      },
    });
    if (!pedido) return next(criarErro(404, "PEDIDO_NAO_ENCONTRADO", "Pedido nao encontrado."));

    // CLIENTE so pode ver seus proprios pedidos
    if (req.usuario.perfil === "CLIENTE" && pedido.clienteId !== req.usuario.id) {
      return next(criarErro(403, "ACESSO_NEGADO", "Voce nao tem acesso a este pedido."));
    }

    return res.json({
      pedidoId:    pedido.id,
      status:      pedido.status,
      canalPedido: pedido.canalPedido,
      total:       Number(pedido.total),
      pagamento:   pedido.pagamento
        ? { status: pedido.pagamento.status, formaPagamento: pedido.pagamento.formaPagamento }
        : null,
      itens: pedido.itens.map((i) => ({
        produtoId:     i.produtoId,
        nome:          i.produto.nome,
        quantidade:    i.quantidade,
        precoUnitario: Number(i.precoUnitario),
        subtotal:      Number(i.precoUnitario) * i.quantidade,
      })),
      createdAt: pedido.createdAt,
      updatedAt: pedido.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

// ── Atualizar Status ──────────────────────────────────────────────────────────
async function atualizarStatus(req, res, next) {
  try {
    const parse = atualizarStatusSchema.safeParse(req.body);
    if (!parse.success) {
      const details = parse.error.errors.map((e) => ({ field: e.path[0], issue: e.message }));
      return next(criarErro(400, "DADOS_INVALIDOS", "Status invalido.", details));
    }

    const { status: novoStatus } = parse.data;

    const pedido = await prisma.pedido.findUnique({ where: { id: req.params.id } });
    if (!pedido) return next(criarErro(404, "PEDIDO_NAO_ENCONTRADO", "Pedido nao encontrado."));

    const transicoesPermitidas = TRANSICOES_VALIDAS[pedido.status] || [];
    if (!transicoesPermitidas.includes(novoStatus)) {
      return next(criarErro(400, "TRANSICAO_INVALIDA",
        `Transicao de ${pedido.status} para ${novoStatus} nao e permitida.`,
        [{ field: "status", issue: `Transicoes validas a partir de ${pedido.status}: ${transicoesPermitidas.join(", ") || "nenhuma"}` }]
      ));
    }

    const atualizado = await prisma.pedido.update({
      where: { id: req.params.id },
      data:  { status: novoStatus },
    });

    await registrar("STATUS_PEDIDO_ATUALIZADO", "pedidos",
      { pedidoId: pedido.id, statusAnterior: pedido.status, novoStatus },
      req.usuario.id, req.ip);

    return res.json({
      pedidoId:  atualizado.id,
      status:    atualizado.status,
      updatedAt: atualizado.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { criar, listar, buscarPorId, atualizarStatus };
