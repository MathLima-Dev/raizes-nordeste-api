// src/api/controllers/auth.controller.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const env = require("../../config/env");
const { criarErro } = require("../middlewares/error.middleware");
const { registrar } = require("../../infrastructure/logger/audit.logger");

const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z.string().email({ message: "E-mail invalido" }),
  senha: z.string().min(1, { message: "Senha obrigatoria" }),
});

async function login(req, res, next) {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      const details = parse.error.errors.map((e) => ({ field: e.path[0], issue: e.message }));
      return next(criarErro(422, "DADOS_INVALIDOS", "Dados de login invalidos.", details));
    }

    const { email, senha } = parse.data;

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.ativo) {
      return next(criarErro(401, "CREDENCIAIS_INVALIDAS", "E-mail ou senha invalidos."));
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaCorreta) {
      return next(criarErro(401, "CREDENCIAIS_INVALIDAS", "E-mail ou senha invalidos."));
    }

    const payload = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

    await registrar("LOGIN", "usuarios", { email }, usuario.id, req.ip);

    return res.status(200).json({
      accessToken,
      tokenType: "Bearer",
      expiresIn: env.JWT_EXPIRES_IN,
      user: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login };
