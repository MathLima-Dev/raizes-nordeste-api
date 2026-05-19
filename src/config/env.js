// src/config/env.js
require("dotenv").config();

const env = {
  PORT:                   process.env.PORT || 3000,
  NODE_ENV:               process.env.NODE_ENV || "development",
  JWT_SECRET:             process.env.JWT_SECRET || "chave_padrao_dev_nao_usar_em_prod",
  JWT_EXPIRES_IN:         process.env.JWT_EXPIRES_IN || "1h",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  PAYMENT_MOCK_MODE:      process.env.PAYMENT_MOCK_MODE || "RANDOM", // RANDOM | APPROVE | REFUSE
};

module.exports = env;
