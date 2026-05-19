// src/api/middlewares/error.middleware.js

/**
 * Middleware de tratamento global de erros.
 * Garante que TODOS os erros retornem no padrao JSON documentado.
 */
function errorMiddleware(err, req, res, next) {
  const status    = err.status || err.statusCode || 500;
  const errorCode = err.code   || "ERRO_INTERNO";
  const message   = err.message || "Erro interno do servidor";
  const details   = err.details || [];

  return res.status(status).json({
    error:     errorCode,
    message,
    details,
    timestamp: new Date().toISOString(),
    path:      req.originalUrl,
  });
}

/**
 * Cria um erro padronizado facilmente.
 */
function criarErro(status, code, message, details = []) {
  const err = new Error(message);
  err.status  = status;
  err.code    = code;
  err.details = details;
  return err;
}

module.exports = { errorMiddleware, criarErro };
