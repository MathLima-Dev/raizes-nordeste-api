// src/api/routes/index.js
const { Router } = require("express");
const rateLimit = require("express-rate-limit");

const { login }            = require("../controllers/auth.controller");
const { cadastrar, meuPerfil } = require("../controllers/usuario.controller");
const { listar: listarProdutos } = require("../controllers/produto.controller");
const { atualizar: atualizarEstoque, consultar: consultarEstoque } = require("../controllers/estoque.controller");
const { criar, listar, buscarPorId, atualizarStatus } = require("../controllers/pedido.controller");
const { consultarSaldo }   = require("../controllers/fidelidade.controller");
const { autenticar, authorize } = require("../middlewares/auth.middleware");

const router = Router();

// Rate limit para rotas de autenticacao
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: { error: "MUITAS_TENTATIVAS", message: "Muitas tentativas. Tente novamente em 15 minutos." },
});

// ── Auth ──────────────────────────────────────────────────────────────────────
/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Autenticar usuario e obter JWT
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, senha]
 *             properties:
 *               email: { type: string, example: "cliente@raizes.com" }
 *               senha: { type: string, example: "Senha@123" }
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *       401:
 *         description: Credenciais invalidas
 */
router.post("/auth/login", authLimiter, login);

// ── Usuarios ──────────────────────────────────────────────────────────────────
/**
 * @openapi
 * /usuarios:
 *   post:
 *     summary: Cadastrar novo usuario (consentimentoLGPD obrigatorio)
 *     tags: [Usuarios]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, email, senha, consentimentoLGPD]
 *             properties:
 *               nome:              { type: string, example: "Maria Silva" }
 *               email:             { type: string, example: "maria@email.com" }
 *               senha:             { type: string, example: "Senha@123" }
 *               perfil:            { type: string, enum: [CLIENTE, ATENDENTE, COZINHA, GERENTE, ADMIN], default: CLIENTE }
 *               consentimentoLGPD: { type: boolean, example: true }
 *     responses:
 *       201: { description: Usuario criado }
 *       400: { description: Sem consentimento LGPD }
 *       409: { description: Email ja cadastrado }
 */
router.post("/usuarios", cadastrar);
router.get("/usuarios/me", autenticar, meuPerfil);

// ── Produtos ──────────────────────────────────────────────────────────────────
/**
 * @openapi
 * /produtos:
 *   get:
 *     summary: Listar produtos disponiveis em uma unidade
 *     tags: [Produtos]
 *     parameters:
 *       - in: query
 *         name: unidadeId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: categoria
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Lista de produtos }
 *       404: { description: Unidade nao encontrada }
 */
router.get("/produtos", autenticar, listarProdutos);

// ── Estoque ───────────────────────────────────────────────────────────────────
/**
 * @openapi
 * /estoque/{unidadeId}/{produtoId}:
 *   get:
 *     summary: Consultar estoque de um produto em uma unidade
 *     tags: [Estoque]
 *     parameters:
 *       - in: path
 *         name: unidadeId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: produtoId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Estoque consultado }
 *   patch:
 *     summary: Movimentar estoque (GERENTE/ADMIN)
 *     tags: [Estoque]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo, quantidade]
 *             properties:
 *               tipo:       { type: string, enum: [ENTRADA, SAIDA] }
 *               quantidade: { type: integer, example: 50 }
 *               motivo:     { type: string, example: "Reposicao semanal" }
 *     responses:
 *       200: { description: Estoque atualizado }
 *       409: { description: Estoque insuficiente para saida }
 */
router.get("/estoque/:unidadeId/:produtoId",   autenticar, authorize("GERENTE","ADMIN"), consultarEstoque);
router.patch("/estoque/:unidadeId/:produtoId", autenticar, authorize("GERENTE","ADMIN"), atualizarEstoque);

// ── Pedidos ───────────────────────────────────────────────────────────────────
/**
 * @openapi
 * /pedidos:
 *   post:
 *     summary: Criar pedido (canalPedido OBRIGATORIO)
 *     tags: [Pedidos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [canalPedido, unidadeId, itens]
 *             properties:
 *               canalPedido:    { type: string, enum: [APP, TOTEM, BALCAO, PICKUP, WEB] }
 *               unidadeId:      { type: string }
 *               itens:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     produtoId:  { type: string }
 *                     quantidade: { type: integer }
 *               formaPagamento: { type: string, enum: [PIX, CARTAO_CREDITO, CARTAO_DEBITO, MOCK] }
 *     responses:
 *       201: { description: Pedido criado }
 *       400: { description: canalPedido invalido ou ausente }
 *       409: { description: Estoque insuficiente }
 *   get:
 *     summary: Listar pedidos (filtravel por canalPedido e status)
 *     tags: [Pedidos]
 *     parameters:
 *       - in: query
 *         name: canalPedido
 *         schema: { type: string, enum: [APP, TOTEM, BALCAO, PICKUP, WEB] }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: unidadeId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Lista paginada de pedidos }
 */
router.post("/pedidos",            autenticar, authorize("CLIENTE","ATENDENTE"), criar);
router.get("/pedidos",             autenticar, listar);
router.get("/pedidos/:id",         autenticar, buscarPorId);
router.patch("/pedidos/:id/status",autenticar, authorize("ATENDENTE","COZINHA","GERENTE","ADMIN"), atualizarStatus);

// ── Fidelidade ────────────────────────────────────────────────────────────────
/**
 * @openapi
 * /fidelidade/saldo:
 *   get:
 *     summary: Consultar saldo de pontos do cliente autenticado
 *     tags: [Fidelidade]
 *     responses:
 *       200: { description: Saldo de pontos }
 *       404: { description: Perfil de fidelidade nao encontrado }
 */
router.get("/fidelidade/saldo", autenticar, authorize("CLIENTE"), consultarSaldo);

module.exports = router;
