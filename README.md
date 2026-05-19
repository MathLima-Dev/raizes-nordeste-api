# Raizes do Nordeste — API Back-End

API REST do Projeto Multidisciplinar UNINTER 2026 — Trilha Back-End.

## Tecnologias

- **Node.js 20 LTS** + **Express 4**
- **PostgreSQL 15** + **Prisma 5** (ORM + Migrations)
- **JWT** (autenticacao) + **bcrypt** (hash de senha)
- **Zod** (validacao) + **Swagger/OpenAPI** (documentacao)
- **Winston** (logs/auditoria) + **Jest + Supertest** (testes)

## Estrutura do Projeto

```
src/
├── api/
│   ├── controllers/   # Logica de cada recurso
│   ├── middlewares/   # Auth, autorização e erros
│   └── routes/        # Definição de rotas + Swagger JSDoc
├── application/       # Services (casos de uso)
├── domain/            # Entidades e enums
├── infrastructure/
│   ├── mock/          # Servico de pagamento mock
│   └── logger/        # Audit logger (Winston)
└── config/            # Env e Swagger
prisma/
├── schema.prisma      # Modelo do banco
├── migrations/        # Historico de migrations
└── seed.js            # Dados iniciais
tests/                 # Testes automatizados (Jest + Supertest)
postman/               # Colecao Postman exportada
```

## Requisitos

- Node.js >= 20
- PostgreSQL >= 15
- npm >= 9

## Instalacao e Execucao

### 1. Clonar o repositorio

```bash
git clone https://github.com/SEU_USUARIO/raizes-nordeste-api.git
cd raizes-nordeste-api
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variaveis de ambiente

```bash
cp .env.example .env
```

Editar o arquivo `.env`:

```env
DATABASE_URL="postgresql://USUARIO:SENHA@localhost:5432/raizes_nordeste"
JWT_SECRET="sua_chave_secreta_forte_aqui"
JWT_EXPIRES_IN="1h"
PORT=3000
NODE_ENV=development
PAYMENT_MOCK_MODE=RANDOM
```

### 4. Criar banco de dados

```bash
# Criar o banco no PostgreSQL primeiro:
# CREATE DATABASE raizes_nordeste;

npx prisma migrate dev --name init
```

### 5. Popular dados iniciais (seed)

```bash
node prisma/seed.js
```

Usuarios criados pelo seed:

| Email | Senha | Perfil |
|---|---|---|
| admin@raizes.com | Senha@123 | ADMIN |
| gerente@raizes.com | Senha@123 | GERENTE |
| cozinha@raizes.com | Senha@123 | COZINHA |
| atendente@raizes.com | Senha@123 | ATENDENTE |
| cliente@raizes.com | Senha@123 | CLIENTE |

### 6. Iniciar a API

```bash
npm run dev
```

A API estara disponivel em: `http://localhost:3000`

### 7. Acessar a documentacao Swagger

```
http://localhost:3000/api-docs
```

### 8. Rodar os testes

```bash
# Certifique-se de ter o banco com seed antes
npm test
```

## Endpoints Principais

| Metodo | Rota | Descricao | Auth |
|---|---|---|---|
| POST | /auth/login | Login | Publico |
| POST | /usuarios | Cadastro | Publico |
| GET | /produtos | Listar produtos por unidade | JWT |
| GET | /estoque/:u/:p | Consultar estoque | GERENTE/ADMIN |
| PATCH | /estoque/:u/:p | Movimentar estoque | GERENTE/ADMIN |
| POST | /pedidos | Criar pedido | CLIENTE/ATENDENTE |
| GET | /pedidos | Listar pedidos | JWT |
| GET | /pedidos/:id | Buscar pedido | JWT |
| PATCH | /pedidos/:id/status | Atualizar status | ATENDENTE/COZINHA/GERENTE |
| GET | /fidelidade/saldo | Consultar pontos | CLIENTE |
| GET | /health | Health check | Publico |

## Fluxo Critico (MVP)

```
POST /auth/login           -> obter token
POST /pedidos              -> criar pedido (canalPedido obrigatorio)
                              -> valida estoque
                              -> processa pagamento mock
                              -> atualiza status automaticamente
PATCH /pedidos/:id/status  -> cozinha atualiza para PRONTO
PATCH /pedidos/:id/status  -> atendente atualiza para ENTREGUE
```

## LGPD

- Consentimento obrigatorio no cadastro (`consentimentoLGPD: true`)
- Senhas com hash bcrypt (fator 12)
- Dados sensiveis nunca retornados em responses
- Todas as acoes sensiveis registradas no AuditLog

## Variaveis de Ambiente

| Variavel | Descricao | Padrao |
|---|---|---|
| DATABASE_URL | String de conexao PostgreSQL | — |
| JWT_SECRET | Chave secreta JWT | — |
| JWT_EXPIRES_IN | Expiracao do token | 1h |
| PORT | Porta do servidor | 3000 |
| NODE_ENV | Ambiente | development |
| PAYMENT_MOCK_MODE | RANDOM, APPROVE ou REFUSE | RANDOM |
