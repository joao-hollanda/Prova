# API — Concurso PF (RP) · ASP.NET Core (.NET 9)

Backend C# que implementa o contrato esperado pelo front React (`../src/api/`). Faz a
correção da prova **no servidor** (o gabarito nunca sai daqui) e garante **uma única
tentativa por edital** por candidato.

## ▶️ Como rodar

```bash
cd api
dotnet run
```

A API sobe em `http://localhost:5000` e expõe os endpoints sob `/api`.

Para o front consumir a API real, crie `../.env` (copie de `../.env.example`) com:

```env
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:5000/api
VITE_ADMIN_SENHA=PF@ILHASP   # precisa ser IGUAL ao Admin:Senha do backend
```

## 🔐 Segurança aplicada (nível "anti-curioso", não militar)

| Medida | Onde |
|---|---|
| **CORS restrito** às origens do front (nunca `*`) | `Program.cs` / `appsettings.json` → `Cors:AllowedOrigins` |
| **Rate limiting por IP** (120/min geral, 12/min em escrita) | `Program.cs` → `RateLimit:*` |
| **Validação server-side** de todos os campos (não confia no cliente) | `Validacoes.cs` |
| **Limite de corpo** da requisição (64 KB) + teto de tamanho/quantidade de respostas | `Program.cs`, `Validacoes.cs` |
| **Gabarito nunca exposto** — removido da prova e da correção | `Models.cs` (`ToPublica`), `Catalogo.cs` |
| **Correção no servidor** (cliente só manda respostas) | `Catalogo.cs` → `Correcao` |
| **Painel protegido por token** (`X-Admin-Token`, comparação em tempo constante) | `Endpoints.cs` → `GuardaAdmin` |
| **Identidade vinda da inscrição** no envio (o `candidato` do cliente só é usado na recuperação abaixo) | `AppStore.RegistrarResultado` |
| **Erros genéricos** (sem stack trace) + headers de segurança | `Program.cs` |

> ⚠️ Como é uma SPA, o token do admin acaba embutido no bundle do front. Para segurança
> real, troque `Admin:Token` por um segredo forte e use um login de verdade no backend.
> Para o uso em RP, o token + CORS + rate limit já impedem o "usuário comum" de bisbilhotar.

## 🎯 Regra de tentativa única por edital

Pedido: *"uma pessoa não pode realizar mais de uma tentativa por edital (valida por ID do
Discord e nome)"*.

- Um **resultado enviado** = uma tentativa. A checagem é feita de forma **atômica** (sob lock)
  na inscrição **e** no envio da prova. Reenvios da **mesma inscrição** não contam como nova
  tentativa: devolvem o resultado já registrado (idempotência).
- Bloqueia se, no edital atual, já existir tentativa com o **mesmo ID do Discord** *OU* o
  **mesmo nome** (normalizado: sem acentos, minúsculo, espaços colapsados). Assim não dá para
  burlar trocando só o nome nem usando uma conta alternativa com o mesmo nome.
- A **identidade** considerada no envio vem da inscrição salva no servidor — o cliente não
  consegue forjar nome/ID no momento de enviar.
- **Trocar de edital reseta a regra**: `POST /api/admin/edital/novo` inicia um novo ciclo
  (ou altere `Edital:Id` em `appsettings.json`). Resultados antigos ficam no histórico, fora
  do ranking atual.

## 🛟 Prevenção contra "Inscrição não encontrada" no envio

A inscrição fica salva no navegador do candidato; se ela sumir do servidor (reset/troca de
banco, novo edital) a pessoa poderia fazer a prova inteira e perder tudo no envio. Duas camadas
evitam isso:

1. **Validação antes de começar** — ao abrir a prova, o front chama `GET /api/inscricoes/{id}`;
   se a inscrição não existir (404) ou for de outro edital (409), o candidato é orientado a
   refazer a inscrição **antes** de responder qualquer questão.
2. **Recuperação no envio** — se mesmo assim a inscrição sumir durante a prova, o
   `POST /api/provas/{carreiraId}/respostas` recria a inscrição a partir do bloco `candidato`
   do payload, passando pelas mesmas validações e regras (edital aberto, tentativa única).
   A prova nunca é descartada por uma inscrição perdida.
3. **Reenvio idempotente** — se a MESMA inscrição reenviar (clique duplo, resposta perdida na
   rede, retry após erro), o servidor devolve o resultado já registrado em vez de bloquear
   com 409. O candidato nunca fica sem ver um resultado que o servidor já aceitou.
4. **Fechar o certame não descarta prova em andamento** — o fechamento impede *inscrever/
   iniciar*; quem já estava com a prova aberta consegue enviá-la normalmente (no front, uma
   sessão de prova já iniciada também continua acessível após o fechamento).
5. **Sessão de prova salva no servidor** — o front faz backup do progresso (respostas + início)
   a cada resposta (debounce de 10 s) e num heartbeat de 30 s. Se o candidato perder o
   navegador/dispositivo, retoma de onde parou em qualquer outro; o início oficial fica no
   servidor (limpar o navegador não reseta o cronômetro).
6. **Ferramentas do painel (aba Candidatos)** — a administração pode **pausar/retomar** a prova
   de alguém (o relógio congela; ao retomar, o tempo pausado é devolvido), **conceder tempo
   extra** por candidato (chega ao vivo, via heartbeat), **liberar um novo envio** (apaga só o
   resultado) e **excluir uma inscrição** (libera a regra de tentativa única).

## 📦 Persistência

Estado (edital, inscrições, resultados, sorteio e correções discursivas) é gravado em PostgreSQL.
Em hospedagem, configure `DATABASE_URL`, `POSTGRES_CONNECTION_STRING` ou `Data:ConnectionString` com a conexão do banco.

## 🔌 Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/inscricoes` | — | Cria inscrição (valida + tentativa única) |
| `GET`  | `/api/inscricoes/{id}` | — | Consulta inscrição (o front valida a sessão salva antes da prova) |
| `GET`  | `/api/provas/{carreiraId}` | — | Prova ATIVA do cargo (sorteada, sem gabarito) |
| `POST` | `/api/provas/{carreiraId}/respostas` | — | Envia respostas → correção |
| `GET`  | `/api/provas/sessao/{inscricaoId}` | — | Sessão de prova salva no servidor (retomada) |
| `POST` | `/api/provas/sessao` | — | Backup do progresso da prova (respostas + início) |
| `GET`  | `/api/config` | — | Configuração efetiva (vagas/duração/nota) — público |
| `GET`  | `/api/admin/prova/status` | — | Status (aberto/fechado) — público |
| `GET`  | `/api/admin/resultados` | `X-Admin-Token` | Ranking do edital atual (PII) |
| `POST` | `/api/admin/prova/status` | `X-Admin-Token` | Abre/fecha a prova |
| `POST` | `/api/admin/config` | `X-Admin-Token` | Edita vagas, qtd. questões, nota de corte, duração |
| `POST` | `/api/admin/prova/sortear` | `X-Admin-Token` | Sorteia a prova + sugere nota de corte |
| `GET`  | `/api/admin/discursivas` | `X-Admin-Token` | Lista discursivas para correção |
| `POST` | `/api/admin/discursivas/corrigir` | `X-Admin-Token` | Lança a nota de uma discursiva |
| `POST` | `/api/admin/edital/novo` | `X-Admin-Token` | Inicia novo edital (reseta tentativas) |
| `GET`  | `/api/admin/inscricoes` | `X-Admin-Token` | Candidatos do edital c/ situação (em prova/pausada/enviada) |
| `POST` | `/api/admin/inscricoes/excluir` | `X-Admin-Token` | Exclui inscrição + resultado + sessão |
| `POST` | `/api/admin/resultados/excluir` | `X-Admin-Token` | Exclui só o resultado (candidato refaz a prova) |
| `POST` | `/api/admin/inscricoes/tempo` | `X-Admin-Token` | Concede tempo extra (min; negativo reduz) |
| `POST` | `/api/admin/sessao/pausar` | `X-Admin-Token` | Pausa/retoma a prova (relógio congela) |

Veja `Pf.Api.http` para exemplos prontos de cada chamada.

## ⚙️ Configuração, sorteio e dificuldade

- O painel admin edita **vagas** (por cargo), **quantidade de questões** (objetivas/discursivas),
  **nota de corte** e **duração** (por cargo). A correção e a prova passam a usar esses valores.
- Cada questão tem um **nível de dificuldade** (`facil`/`medio`/`dificil`) definido no servidor
  (`Data/Catalogo.cs`).
- **Sortear** (`/admin/prova/sortear`) escolhe aleatoriamente N objetivas + M discursivas por cargo
  e **fixa essa seleção** — a prova é a **mesma para todos** os candidatos do edital. Com base na
  dificuldade das objetivas sorteadas, sugere uma **nota de corte** (prova fácil → corte mais alto;
  difícil → mais baixo). A sugestão é informativa; aplica-se ao salvar a configuração.
- Sem sorteio ativo, a prova é o banco completo (comportamento padrão).

## 🔑 Senha do painel

`Admin:Senha` = `PF@ILHASP` (em `appsettings.json`). Deve ser igual ao `VITE_ADMIN_SENHA` do front.
