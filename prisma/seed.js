// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed...");

  // Limpar na ordem correta (FK)
  await prisma.auditLog.deleteMany();
  await prisma.pagamento.deleteMany();
  await prisma.itensPedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.pontosFidelidade.deleteMany();
  await prisma.estoqueUnidade.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.unidade.deleteMany();
  await prisma.usuario.deleteMany();

  // Usuarios
  const senhaHash = await bcrypt.hash("Senha@123", 12);

  const admin = await prisma.usuario.create({
    data: {
      nome: "Administrador",
      email: "admin@raizes.com",
      senhaHash,
      perfil: "ADMIN",
      consentimentoLGPD: true,
      dataConsentimento: new Date(),
    },
  });

  const gerente = await prisma.usuario.create({
    data: {
      nome: "Gerente Recife",
      email: "gerente@raizes.com",
      senhaHash,
      perfil: "GERENTE",
      consentimentoLGPD: true,
      dataConsentimento: new Date(),
    },
  });

  const cozinha = await prisma.usuario.create({
    data: {
      nome: "Cozinha Central",
      email: "cozinha@raizes.com",
      senhaHash,
      perfil: "COZINHA",
      consentimentoLGPD: true,
      dataConsentimento: new Date(),
    },
  });

  const atendente = await prisma.usuario.create({
    data: {
      nome: "Atendente Joao",
      email: "atendente@raizes.com",
      senhaHash,
      perfil: "ATENDENTE",
      consentimentoLGPD: true,
      dataConsentimento: new Date(),
    },
  });

  const cliente = await prisma.usuario.create({
    data: {
      nome: "Maria Cliente",
      email: "cliente@raizes.com",
      senhaHash,
      perfil: "CLIENTE",
      consentimentoLGPD: true,
      dataConsentimento: new Date(),
      pontosFidelidade: { create: { saldo: 100 } },
    },
  });

  console.log("Usuarios criados");

  // Unidades
  const unidade1 = await prisma.unidade.create({
    data: { nome: "Raizes Recife Centro", cidade: "Recife", estado: "PE", cozinhaCompleta: true },
  });

  const unidade2 = await prisma.unidade.create({
    data: { nome: "Raizes Fortaleza", cidade: "Fortaleza", estado: "CE", cozinhaCompleta: false },
  });

  console.log("Unidades criadas");

  // Produtos
  const tapioca = await prisma.produto.create({
    data: { nome: "Tapioca de Frango", descricao: "Tapioca recheada com frango desfiado", preco: 12.90, categoria: "Salgados" },
  });

  const cuscuz = await prisma.produto.create({
    data: { nome: "Cuscuz Recheado", descricao: "Cuscuz com carne de sol e queijo coalho", preco: 15.50, categoria: "Salgados" },
  });

  const macaxeira = await prisma.produto.create({
    data: { nome: "Bolo de Macaxeira", descricao: "Bolo tradicional nordestino", preco: 8.00, categoria: "Doces" },
  });

  const suco = await prisma.produto.create({
    data: { nome: "Suco de Cajá", descricao: "Suco natural de cajá", preco: 7.00, categoria: "Bebidas" },
  });

  const cafe = await prisma.produto.create({
    data: { nome: "Cafe Nordestino", descricao: "Cafe passado na hora com rapadura", preco: 5.00, categoria: "Bebidas" },
  });

  console.log("Produtos criados");

  // Estoques — unidade 1
  await prisma.estoqueUnidade.createMany({
    data: [
      { unidadeId: unidade1.id, produtoId: tapioca.id,   quantidadeDisponivel: 50 },
      { unidadeId: unidade1.id, produtoId: cuscuz.id,    quantidadeDisponivel: 30 },
      { unidadeId: unidade1.id, produtoId: macaxeira.id, quantidadeDisponivel: 20 },
      { unidadeId: unidade1.id, produtoId: suco.id,      quantidadeDisponivel: 40 },
      { unidadeId: unidade1.id, produtoId: cafe.id,      quantidadeDisponivel: 100 },
    ],
  });

  // Estoques — unidade 2
  await prisma.estoqueUnidade.createMany({
    data: [
      { unidadeId: unidade2.id, produtoId: tapioca.id, quantidadeDisponivel: 25 },
      { unidadeId: unidade2.id, produtoId: cafe.id,    quantidadeDisponivel: 60 },
      { unidadeId: unidade2.id, produtoId: suco.id,    quantidadeDisponivel: 0 },  // sem estoque para testes
    ],
  });

  console.log("Estoques criados");
  console.log("\n=== SEED CONCLUIDO ===");
  console.log("Usuarios para login:");
  console.log("  admin@raizes.com      / Senha@123  (ADMIN)");
  console.log("  gerente@raizes.com    / Senha@123  (GERENTE)");
  console.log("  cozinha@raizes.com    / Senha@123  (COZINHA)");
  console.log("  atendente@raizes.com  / Senha@123  (ATENDENTE)");
  console.log("  cliente@raizes.com    / Senha@123  (CLIENTE)");
  console.log(`\nUnidade 1 ID: ${unidade1.id}`);
  console.log(`Unidade 2 ID: ${unidade2.id}`);
  console.log(`Produto Tapioca ID: ${tapioca.id}`);
  console.log(`Produto Cuscuz ID:  ${cuscuz.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
