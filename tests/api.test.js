// tests/api.test.js
const request = require("supertest");
const app     = require("../src/app");

// Variaveis compartilhadas entre testes
let tokenCliente, tokenGerente, tokenCozinha, tokenAdmin;
let unidadeId, produtoIdTapioca, produtoIdSuco;
let pedidoIdCriado;

// Helper para login
async function login(email) {
  const res = await request(app)
    .post("/auth/login")
    .send({ email, senha: "Senha@123" });
  return res.body.accessToken;
}

beforeAll(async () => {
  // Os tokens dependem do seed ter sido executado
  tokenCliente  = await login("cliente@raizes.com");
  tokenGerente  = await login("gerente@raizes.com");
  tokenCozinha  = await login("cozinha@raizes.com");
  tokenAdmin    = await login("admin@raizes.com");

  // Buscar IDs dinamicamente via produtos (precisa de unidadeId do seed)
  // Esses valores serao preenchidos nas rotas que retornam os dados
});

// ══════════════════════════════════════════════════════════════════════════════
// T01 — Login valido
// ══════════════════════════════════════════════════════════════════════════════
test("T01 — Login valido retorna 200 + accessToken", async () => {
  const res = await request(app)
    .post("/auth/login")
    .send({ email: "cliente@raizes.com", senha: "Senha@123" });

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("accessToken");
  expect(res.body).toHaveProperty("tokenType", "Bearer");
  expect(res.body.user).toHaveProperty("perfil", "CLIENTE");
});

// ══════════════════════════════════════════════════════════════════════════════
// T02 — Login com senha errada
// ══════════════════════════════════════════════════════════════════════════════
test("T02 — Login com senha errada retorna 401", async () => {
  const res = await request(app)
    .post("/auth/login")
    .send({ email: "cliente@raizes.com", senha: "senhaErrada" });

  expect(res.status).toBe(401);
  expect(res.body.error).toBe("CREDENCIAIS_INVALIDAS");
});

// ══════════════════════════════════════════════════════════════════════════════
// T03 — Acesso sem token
// ══════════════════════════════════════════════════════════════════════════════
test("T03 — Acesso sem token retorna 401", async () => {
  const res = await request(app).get("/pedidos");

  expect(res.status).toBe(401);
  expect(res.body.error).toBe("TOKEN_AUSENTE");
});

// ══════════════════════════════════════════════════════════════════════════════
// T04 — Acesso com perfil insuficiente
// ══════════════════════════════════════════════════════════════════════════════
test("T04 — CLIENTE tentando acessar rota de GERENTE retorna 403", async () => {
  const res = await request(app)
    .patch("/estoque/uuid-qualquer/uuid-qualquer")
    .set("Authorization", `Bearer ${tokenCliente}`)
    .send({ tipo: "ENTRADA", quantidade: 10 });

  expect(res.status).toBe(403);
  expect(res.body.error).toBe("ACESSO_NEGADO");
});

// ══════════════════════════════════════════════════════════════════════════════
// T05 — Cadastro sem consentimento LGPD
// ══════════════════════════════════════════════════════════════════════════════
test("T05 — Cadastro sem consentimentoLGPD retorna 400", async () => {
  const res = await request(app)
    .post("/usuarios")
    .send({
      nome:              "Teste Sem LGPD",
      email:             `semLGPD_${Date.now()}@test.com`,
      senha:             "Senha@123",
      consentimentoLGPD: false,
    });

  expect(res.status).toBe(400);
  expect(res.body.error).toBe("CONSENTIMENTO_OBRIGATORIO");
});

// ══════════════════════════════════════════════════════════════════════════════
// T06 — Criar pedido valido via TOTEM (depende de unidadeId e produtoId do seed)
// ══════════════════════════════════════════════════════════════════════════════
test("T06 — Criar pedido valido via TOTEM retorna 201", async () => {
  // Primeiro buscar uma unidade valida
  const unidadesRes = await request(app)
    .get("/produtos?unidadeId=00000000-0000-0000-0000-000000000000") // unidade fake para teste
    .set("Authorization", `Bearer ${tokenCliente}`);

  // O teste T06 depende do banco populado com seed
  // Se nao tiver seed, pula este teste
  if (!tokenCliente) {
    console.warn("T06: seed nao executado, pulando teste de pedido");
    return;
  }

  // Buscar unidades via admin
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  const unidade = await prisma.unidade.findFirst({ where: { ativa: true } });
  const produto  = await prisma.produto.findFirst({ where: { ativo: true } });
  const estoque  = await prisma.estoqueUnidade.findFirst({
    where: { unidadeId: unidade?.id, quantidadeDisponivel: { gt: 0 } },
  });

  await prisma.$disconnect();

  if (!unidade || !estoque) {
    console.warn("T06: seed nao encontrado no banco, pulando");
    return;
  }

  const res = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${tokenCliente}`)
    .send({
      canalPedido:    "TOTEM",
      unidadeId:      unidade.id,
      itens:          [{ produtoId: estoque.produtoId, quantidade: 1 }],
      formaPagamento: "MOCK",
    });

  expect(res.status).toBe(201);
  expect(res.body).toHaveProperty("pedidoId");
  expect(res.body.canalPedido).toBe("TOTEM");
  pedidoIdCriado = res.body.pedidoId;
});

// ══════════════════════════════════════════════════════════════════════════════
// T07 — Criar pedido sem canalPedido
// ══════════════════════════════════════════════════════════════════════════════
test("T07 — Pedido sem canalPedido retorna 400", async () => {
  const res = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${tokenCliente}`)
    .send({
      unidadeId:      "uuid-qualquer",
      itens:          [{ produtoId: "uuid-qualquer", quantidade: 1 }],
      formaPagamento: "MOCK",
    });

  expect(res.status).toBe(400);
  expect(res.body.error).toBe("DADOS_INVALIDOS");
  expect(JSON.stringify(res.body.details)).toContain("canalPedido");
});

// ══════════════════════════════════════════════════════════════════════════════
// T08 — canalPedido invalido
// ══════════════════════════════════════════════════════════════════════════════
test("T08 — canalPedido invalido retorna 400", async () => {
  const res = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${tokenCliente}`)
    .send({
      canalPedido:    "DRIVE_THRU",
      unidadeId:      "uuid-qualquer",
      itens:          [{ produtoId: "uuid-qualquer", quantidade: 1 }],
      formaPagamento: "MOCK",
    });

  expect(res.status).toBe(400);
  expect(res.body.error).toBe("DADOS_INVALIDOS");
});

// ══════════════════════════════════════════════════════════════════════════════
// T09 — Produto inexistente
// ══════════════════════════════════════════════════════════════════════════════
test("T09 — Pedido com produto inexistente retorna 404", async () => {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const unidade = await prisma.unidade.findFirst({ where: { ativa: true } });
  await prisma.$disconnect();

  if (!unidade) return;

  const res = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${tokenCliente}`)
    .send({
      canalPedido:    "APP",
      unidadeId:      unidade.id,
      itens:          [{ produtoId: "00000000-0000-0000-0000-000000000000", quantidade: 1 }],
      formaPagamento: "MOCK",
    });

  expect(res.status).toBe(404);
  expect(res.body.error).toBe("PRODUTO_NAO_ENCONTRADO");
});

// ══════════════════════════════════════════════════════════════════════════════
// T10 — Estoque insuficiente
// ══════════════════════════════════════════════════════════════════════════════
test("T10 — Pedido com estoque zerado retorna 409", async () => {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const unidade = await prisma.unidade.findFirst({ where: { ativa: true } });
  const estoqueZero = await prisma.estoqueUnidade.findFirst({
    where: { unidadeId: unidade?.id, quantidadeDisponivel: 0 },
  });
  await prisma.$disconnect();

  if (!unidade || !estoqueZero) {
    console.warn("T10: nao encontrou estoque zerado para testar");
    return;
  }

  const res = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${tokenCliente}`)
    .send({
      canalPedido:    "APP",
      unidadeId:      unidade.id,
      itens:          [{ produtoId: estoqueZero.produtoId, quantidade: 5 }],
      formaPagamento: "MOCK",
    });

  expect(res.status).toBe(409);
  expect(res.body.error).toBe("ESTOQUE_INSUFICIENTE");
});

// ══════════════════════════════════════════════════════════════════════════════
// T11 — Filtrar pedidos por canal APP
// ══════════════════════════════════════════════════════════════════════════════
test("T11 — Filtrar pedidos por canal APP retorna 200 com lista", async () => {
  const res = await request(app)
    .get("/pedidos?canalPedido=APP&page=1&limit=5")
    .set("Authorization", `Bearer ${tokenGerente}`);

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("data");
  expect(res.body).toHaveProperty("total");
  expect(Array.isArray(res.body.data)).toBe(true);
});

// ══════════════════════════════════════════════════════════════════════════════
// T12 — Atualizar status para PRONTO (precisa de pedido EM_PREPARO)
// ══════════════════════════════════════════════════════════════════════════════
test("T12 — Atualizar status do pedido para PRONTO", async () => {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const pedido = await prisma.pedido.findFirst({ where: { status: "EM_PREPARO" } });
  await prisma.$disconnect();

  if (!pedido) {
    console.warn("T12: nenhum pedido EM_PREPARO encontrado, pulando");
    return;
  }

  const res = await request(app)
    .patch(`/pedidos/${pedido.id}/status`)
    .set("Authorization", `Bearer ${tokenCozinha}`)
    .send({ status: "PRONTO" });

  expect(res.status).toBe(200);
  expect(res.body.status).toBe("PRONTO");
});

// ══════════════════════════════════════════════════════════════════════════════
// T13 — Transicao de status invalida
// ══════════════════════════════════════════════════════════════════════════════
test("T13 — Transicao de status invalida retorna 400", async () => {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const pedido = await prisma.pedido.findFirst({ where: { status: "ENTREGUE" } });
  await prisma.$disconnect();

  if (!pedido) {
    // Criar cenario: tentar mover CANCELADO para EM_PREPARO
    const pedidoCancelado = await (async () => {
      const p = new PrismaClient();
      const r = await p.pedido.findFirst({ where: { status: "CANCELADO" } });
      await p.$disconnect();
      return r;
    })();

    if (!pedidoCancelado) {
      console.warn("T13: nenhum pedido ENTREGUE ou CANCELADO para testar transicao invalida");
      return;
    }

    const res = await request(app)
      .patch(`/pedidos/${pedidoCancelado.id}/status`)
      .set("Authorization", `Bearer ${tokenGerente}`)
      .send({ status: "EM_PREPARO" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("TRANSICAO_INVALIDA");
    return;
  }

  const res = await request(app)
    .patch(`/pedidos/${pedido.id}/status`)
    .set("Authorization", `Bearer ${tokenGerente}`)
    .send({ status: "EM_PREPARO" });

  expect(res.status).toBe(400);
  expect(res.body.error).toBe("TRANSICAO_INVALIDA");
});

// ══════════════════════════════════════════════════════════════════════════════
// T14 — Listar pedidos sem token
// ══════════════════════════════════════════════════════════════════════════════
test("T14 — Listar pedidos sem token retorna 401", async () => {
  const res = await request(app).get("/pedidos");
  expect(res.status).toBe(401);
});

// ══════════════════════════════════════════════════════════════════════════════
// T15 — Health check
// ══════════════════════════════════════════════════════════════════════════════
test("T15 — Health check retorna status ok", async () => {
  const res = await request(app).get("/health");
  expect(res.status).toBe(200);
  expect(res.body.status).toBe("ok");
});
