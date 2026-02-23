# 🍽️ Sistema de Gestão para Cafeterias e Restaurantes

Sistema SaaS completo para gestão de cafeterias e restaurantes, com PDV otimizado para touch, controle de estoque, área financeira e muito mais.

## ✨ Funcionalidades

### 🔐 Sistema de Autenticação
- Login com email/senha
- Recuperação de senha
- 3 níveis de acesso hierárquico:
  - **Master**: Acesso total a todos os clientes
  - **Admin**: Acesso à área administrativa do estabelecimento
  - **Funcionário**: Acesso apenas ao PDV

### 👔 Painel Master
- Dashboard com visão geral de todos os clientes
- Cadastro e gestão de empresas
- Controle de assinaturas (ativo/inativo/bloqueado)
- Métricas de uso por cliente

### 📊 Painel Administrativo
- **Cadastros**: Funcionários, Produtos, Categorias, Mesas
- **Estoque**: Entradas, saídas, ajustes, alertas de estoque baixo
- **Financeiro**: Fluxo de caixa, contas a pagar/receber, relatórios
- **Relatórios**: Gráficos de vendas, produtos mais vendidos, formas de pagamento

### 🛒 PDV (Ponto de Venda)
- Interface otimizada para telas touch
- Produtos em destaque configuráveis
- Filtro por categorias com cores
- Seleção de mesa/balcão/delivery
- Carrinho com quantidades e observações
- Descontos (percentual ou valor)
- Múltiplas formas de pagamento

## 🚀 Tecnologias

- **Frontend**: Next.js 15 + TypeScript
- **Backend**: Firebase (Firestore, Authentication)
- **UI**: Tailwind CSS + shadcn/ui
- **Gráficos**: Recharts
- **Ícones**: Lucide React

## 📋 Pré-requisitos

- Node.js 18+
- Conta no Firebase com projeto criado
- Firestore e Authentication habilitados

## ⚙️ Configuração

### 1. Clone o repositório
\`\`\`bash
git clone https://github.com/mbaisi200/sistema-restaurantes-cafeterias.git
cd sistema-restaurantes-cafeterias
\`\`\`

### 2. Instale as dependências
\`\`\`bash
bun install
\`\`\`

### 3. Configure as variáveis de ambiente
Crie um arquivo \`.env.local\` na raiz do projeto com as credenciais do Firebase:

\`\`\`env
NEXT_PUBLIC_FIREBASE_API_KEY=sua-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=seu-app-id
\`\`\`

### 4. Configure o Firebase

#### Authentication
1. No Firebase Console, vá em **Authentication** → **Sign-in method**
2. Habilite **Email/Password**

#### Firestore
1. Vá em **Firestore Database** → **Create database**
2. Crie as seguintes coleções:
   - \`empresas\` - Dados dos estabelecimentos
   - \`usuarios\` - Usuários do sistema
   - \`produtos\` - Cardápio
   - \`categorias\` - Categorias de produtos
   - \`mesas\` - Mesas do estabelecimento
   - \`funcionarios\` - Funcionários
   - \`vendas\` - Vendas realizadas
   - \`estoque_movimentos\` - Movimentação de estoque
   - \`pagamentos\` - Pagamentos

#### Criar usuário Master inicial
Adicione um documento na coleção \`usuarios\` com o UID do Firebase Auth:

\`\`\`json
{
  "email": "admin@sistema.com",
  "nome": "Administrador Master",
  "role": "master",
  "ativo": true,
  "criadoEm": "2025-01-01T00:00:00.000Z",
  "atualizadoEm": "2025-01-01T00:00:00.000Z"
}
\`\`\`

### 5. Execute o projeto
\`\`\`bash
bun run dev
\`\`\`

Acesse http://localhost:3000

## 📁 Estrutura do Projeto

\`\`\`
src/
├── app/                    # Páginas (App Router)
│   ├── admin/             # Área administrativa
│   ├── master/            # Painel master
│   ├── pdv/               # PDV
│   └── recuperar-senha/   # Recuperação de senha
├── components/
│   ├── auth/              # Componentes de autenticação
│   ├── layout/            # Layout e navegação
│   └── ui/                # Componentes shadcn/ui
├── contexts/              # Contextos React
├── hooks/                 # Hooks customizados
├── lib/                   # Utilitários e Firebase
└── types/                 # Tipos TypeScript
\`\`\`

## 🔒 Regras de Segurança Firestore

Configure as regras no Firebase Console:

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuários só acessam seus próprios dados
    match /usuarios/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Empresas - isolamento por empresa
    match /empresas/{empresaId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role == 'master';
    }
    
    // Produtos, categorias, mesas - por empresa
    match /produtos/{produtoId} {
      allow read, write: if request.auth != null && 
        resource.data.empresaId == get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.empresaId;
    }
    
    // Vendas - por empresa
    match /vendas/{vendaId} {
      allow read, write: if request.auth != null;
    }
  }
}
\`\`\`

## 📞 Suporte

Para dúvidas ou sugestões, abra uma issue no GitHub.

---

Desenvolvido com ❤️ usando Next.js e Firebase

