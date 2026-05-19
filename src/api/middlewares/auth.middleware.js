// src/api/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");
const env = require("../../config/env");
const { criarErro } = require("./error.middleware");

/**
 * Verifica se o token JWT e valido e injeta req.usuario.
 */
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(criarErro(401, "TOKEN_AUSENTE", "Token de autenticacao nao fornecido."));
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(criarErro(401, "TOKEN_EXPIRADO", "Token expirado. Faca login novamente."));
    }
    return next(criarErro(401, "TOKEN_INVALIDO", "Token invalido."));
  }
}

/**
 * Verifica se o usuario autenticado possui um dos perfis permitidos.
 * @param {...string} perfis - Ex: authorize("ADMIN", "GERENTE")
 */
function authorize(...perfis) {
  return (req, res, next) => {
    if (!req.usuario) {
      return next(criarErro(401, "NAO_AUTENTICADO", "Autenticacao necessaria."));
    }
    if (!perfis.includes(req.usuario.perfil)) {
      return next(
        criarErro(403, "ACESSO_NEGADO",
          `Acesso negado. Perfis permitidos: ${perfis.join(", ")}.`)
      );
    }
    next();
  };
}

module.exports = { autenticar, authorize };
