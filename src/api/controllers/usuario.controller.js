// src/api/controllers/usuario.controller.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { z } = require("zod");
const { criarErro } = require("../middlewares/error.middleware");
const { registrar } = require("../../infrastructure/logger/audit.logger");

const prisma = new PrismaClient();

const cadastroSchema = z.object({
  nome:             z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email:            z.string().email("E-mail invalido"),
  senha:            z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  perfil:           z.enum(["CLIENTE","ATENDENTE","COZINHA","GERENTE","ADMIN"]).optional().default("CLIENTE"),
  consentimentoLGPD: z.boolean({ required_error: "Consentimento LGPD obrigatorio" }),
});

async function cadastrar(req, res, next) {
  try {
    const parse = cadastroSchema.safeParse(req.body);
    if (!parse.success) {
      const details = parse.error.errors.map((e) => ({ field: e.path[0], issue: e.message }));
      return next(criarErro(422, "DADOS_INVALIDOS", "Dados de cadastro invalidos.", details));
    }

    const { nome, email, senha, perfil, consentimentoLGPD } = parse.data;

    if (!consentimentoLGPD) {
      return next(criarErro(400, "CONSENTIMENTO_OBRIGATORIO",
        "O consentimento LGPD e obrigatorio para cadastro.",
        [{ field: "consentimentoLGPD", issue: "Deve ser true" }]));
    }

    // Apenas ADMIN pode criar perfis diferentes de CLIENTE
    if (perfil !== "CLIENTE" && (!req.usuario || req.usuario.perfil !== "ADMIN")) {
      return next(criarErro(403, "ACESSO_NEGADO", "Somente ADMIN pode criar usuarios com outros perfis."));
    }

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) {
      return next(criarErro(409, "EMAIL_JA_CADASTRADO", "Este e-mail ja esta em uso."));
    }

    const senhaHash = await bcrypt.hash(senha, 12);
    const usuario = await prisma.usuario.create({
      data: {
        nome, email, senhaHash, perfil,
        consentimentoLGPD: true,
        dataConsentimento: new Date(),
        pontosFidelidade: perfil === "CLIENTE" ? { create: { saldo: 0 } } : undefined,
      },
    });

    await registrar("USUARIO_CADASTRADO", "usuarios", { email, perfil }, usuario.id, req.ip);

    return res.status(201).json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      createdAt: usuario.createdAt,
    });
  } catch (err) {
    next(err);
  }
}

async function meuPerfil(req, res, next) {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { id: true, nome: true, email: true, perfil: true, createdAt: true },
    });
    if (!usuario) return next(criarErro(404, "USUARIO_NAO_ENCONTRADO", "Usuario nao encontrado."));
    return res.json(usuario);
  } catch (err) {
    next(err);
  }
}

module.exports = { cadastrar, meuPerfil };
