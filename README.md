# Concurso Público PCSP — Ilha em São Paulo (Frontend React)

Site de simulação de **concurso público da Polícia Civil do Estado de São Paulo** para uso em
**RP (roleplay)**. O candidato faz a inscrição, escolhe um cargo e realiza uma prova objetiva +
discursiva de nível médio, cobrindo as áreas típicas desses certames.

Construído em **React + Vite**. Funciona com **dados mockados** por padrão e já está preparado
para **consumir uma API em C# (ASP.NET Core)** — basta trocar uma variável de ambiente.

---

## ✨ Funcionalidades

- **Página inicial** com os 4 cargos (Agente, Investigador, Perito, Delegado), vagas e áreas.
- **Inscrição** com validação de Nome, E-mail (real), Idade e ID do Discord + escolha do cargo,
  com **checkbox de consentimento** deixando claro que é um RP sem vínculo real.
- **Prova** específica por cargo + conteúdo comum, com:
  - questões **fechadas** (múltipla escolha) e **abertas** (discursivas);
  - **cronômetro regressivo** com envio automático ao esgotar o tempo;
  - barra de progresso, aviso ao sair da aba e confirmação antes de enviar.
- **Resultado**: correção automática das objetivas (apenas o desempenho geral; **o gabarito não é
  divulgado**, para evitar cola) e questões discursivas marcadas como **"em análise"** pela banca.
- **Comprovante em PDF** com os dados do candidato e o resultado, para apresentação na ACADEPOL.
- **Painel administrativo** (`/admin`, protegido por senha) com **ranking em tempo real** e botão
  para **fechar/reabrir a prova** (quando fechada, novos candidatos não conseguem se inscrever/iniciar).
- Sessão persistida em `localStorage`.

---

## 🚀 Como rodar

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173`.

Para gerar a build de produção:

```bash
npm run build
npm run preview
```

---

## 🔌 Mock x API real

A integração é controlada por variáveis de ambiente (Vite). Copie `.env.example` para `.env`:

```env
# true  -> usa dados mockados (padrão, não precisa de backend)
# false -> consome a API C# real
VITE_USE_MOCK=true

# URL base da API C# (usada quando VITE_USE_MOCK=false)
VITE_API_URL=http://localhost:5000/api
```

Toda a comunicação está isolada na pasta `src/api/`:

- `config.js` — flags e URL base.
- `client.js` — wrapper de `fetch`.
- `inscricoes.js` — `criarInscricao()`.
- `provas.js` — `getProva()` e `enviarProva()`.

Quando `VITE_USE_MOCK=false`, essas funções chamam os endpoints REST descritos abaixo.
**Nenhuma outra parte do app precisa mudar.**

---

## 📑 Contrato esperado da API C# (ASP.NET Core)

A API deve expor os endpoints abaixo (prefixo `VITE_API_URL`, ex.: `/api`). Lembre de habilitar
**CORS** para a origem do front (`http://localhost:5173`).

### 1. Criar inscrição
`POST /inscricoes`

```jsonc
// request
{ "nome": "João da Silva", "email": "joao@exemplo.com", "idade": 25,
  "cpf": "123456789012345678", "carreira": "agente" }

// response 200/201
{ "id": "guid", "nome": "...", "email": "...", "idade": 25, "cpf": "...",
  "carreira": "agente", "protocolo": "PCSP-2026-123456", "criadoEm": "2026-06-29T12:00:00Z" }
```

`GET /inscricoes/{id}` — consulta a inscrição. O front chama antes de iniciar a prova para
validar a sessão salva no navegador (404 = não existe; 409 = de um edital anterior). Assim o
candidato refaz a inscrição **antes** de responder, e não descobre o problema só no envio.

### 2. Buscar prova do cargo
`GET /provas/{carreiraId}`  — `carreiraId` ∈ `agente | investigador | perito | delegado`

> ⚠️ **Não** retorne o gabarito das questões.

```jsonc
// response 200
{
  "carreira": "Agente de Polícia",
  "carreiraId": "agente",
  "duracaoMinutos": 90,
  "totalQuestoes": 18,
  "questoes": [
    { "id": "pt-01", "area": "Língua Portuguesa", "tipo": "fechada",
      "enunciado": "...", "pontos": 1,
      "alternativas": [ { "id": "a", "texto": "..." }, { "id": "b", "texto": "..." } ] },
    { "id": "disc-comum-01", "area": "Questão Discursiva", "tipo": "aberta",
      "enunciado": "...", "pontos": 10, "linhasSugeridas": 15 }
  ]
}
```

### 3. Enviar respostas (correção)
`POST /provas/{carreiraId}/respostas`

```jsonc
// request
{ "inscricaoId": "guid", "carreiraId": "agente",
  "respostas": { "pt-01": "c", "mat-01": "b", "disc-comum-01": "Texto da redação..." },
  "tempoGastoSegundos": 1830, "finalizadaPor": "manual",
  "candidato": { "nome": "João da Silva", "email": "joao@exemplo.com", "idade": 25,
    "cpf": "123456789012345678" } }
```

> 🛟 Se a inscrição tiver sumido do servidor (reset de banco etc.), o backend **recria a
> inscrição** a partir do bloco `candidato` — com as mesmas validações e a regra de tentativa
> única — em vez de rejeitar o envio. A prova do candidato nunca é perdida.

```jsonc

// response 200 (correção feita no servidor)
{
  "carreiraId": "agente",
  "corrigidoEm": "2026-06-29T12:30:00Z",
  "objetivas": {
    "total": 13, "acertos": 9, "erros": 4, "percentual": 69,
    "notaDeCorte": 60, "aprovadoPreliminar": true
  },
  // Importante: NÃO retorne o gabarito nem as respostas marcadas — evita "cola" entre candidatos.
  "discursivas": [
    { "questaoId": "disc-comum-01", "area": "Questão Discursiva", "resposta": "...", "status": "EM_ANALISE" }
  ]
}
```

### 4. Painel administrativo

`GET /admin/resultados` — lista os resultados enviados (alimenta o ranking).

```jsonc
// response 200 — array de registros
[
  { "inscricaoId": "guid", "nome": "João da Silva", "email": "joao@exemplo.com",
    "idade": 25, "cpf": "123456789012345678", "carreiraId": "agente",
    "carreiraNome": "Agente de Polícia", "percentual": 69, "acertos": 9, "total": 13,
    "aprovadoPreliminar": true, "tempoGastoSegundos": 1830, "enviadoEm": "2026-06-29T12:30:00Z" }
]
```

`GET /admin/prova/status` — situação da prova.

```jsonc
{ "fechada": false, "atualizadoEm": "2026-06-29T12:00:00Z" }
```

`POST /admin/prova/status` — abre/fecha a prova.

```jsonc
// request
{ "fechada": true }
// response: o mesmo objeto de status atualizado
```

> O ranking é ordenado no front por `percentual` (desc) e, em empate, por `tempoGastoSegundos` (asc).
> O front atualiza o ranking por polling (a cada 4s) — o backend só precisa expor os dados atuais.
> O acesso ao painel é protegido por senha no front **e** no backend: as chamadas a
> `GET /admin/resultados` e `POST /admin/prova/status` enviam o header `X-Admin-Token`
> (= `VITE_ADMIN_SENHA`), que o backend confere contra `Admin:Token`. O endpoint público
> `GET /admin/prova/status` não exige token (candidatos consultam se a prova está aberta).

> O formato de resposta dos mocks (em `src/api/`) é a referência exata dos campos esperados.

### 5. Regra de tentativa única por edital

O backend impede **mais de uma tentativa por edital** por candidato, validando por **ID do
Discord (`cpf`) e nome**: bloqueia (HTTP 409) se já houver uma prova enviada com o mesmo ID
**ou** o mesmo nome no edital atual — tanto na inscrição quanto no envio. Para iniciar um novo
ciclo (zerando a regra), há `POST /admin/edital/novo` (protegido por `X-Admin-Token`).

> 🔧 A implementação completa do backend C# está em [`api/`](./api/README.md) — inclui CORS
> restrito, rate limiting, validação server-side e correção no servidor.

---

## 🗂️ Estrutura

```
src/
├── api/            # camada de integração (mock + chamadas reais)
├── components/     # Header, Footer, Timer, Questao
├── context/        # InscricaoContext (estado da sessão do candidato)
├── data/           # carreiras.js e banco de questões (questoes.js)
├── pages/          # Home, Inscricao, Prova, Resultado
├── utils/          # validators.js
├── App.jsx         # rotas
└── main.jsx        # bootstrap
```

## 🧩 Adicionar/editar questões

Edite `src/data/questoes.js`. Há um bloco `COMUM` (todas as carreiras) e blocos específicos
(`AGENTE`, `INVESTIGADOR`, `PERITO`, `DELEGADO`). Cada questão fechada tem `gabarito` (usado só na
correção, nunca enviado ao candidato).

---

*Projeto do servidor de roleplay **Ilha em São Paulo**. Sem vínculo oficial com a Polícia Civil do Estado de São Paulo.*
