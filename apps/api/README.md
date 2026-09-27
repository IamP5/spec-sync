# SpecSync API

Serviço Spring Boot 4 (Java 25) que fica atrás do gateway do SpecSync. É
responsável pelo catálogo de veículos, pelas comparações, pela curadoria das
fontes ingeridas, pela ontologia, pelas pesquisas compartilhadas de veículos e
pela carteira de créditos de IA.

- Arquitetura da solução, diagrama de componentes e fluxos de autenticação:
  [`docs/architecture/solution-architecture.md`](../../docs/architecture/solution-architecture.md)
- Regras da arquitetura interna: [`docs/architecture-boundaries.md`](docs/architecture-boundaries.md)
  e as ADRs em [`docs/adr/`](docs/adr/)
- Última execução dos testes: [`docs/test-evidence.md`](docs/test-evidence.md)

## Como executar localmente

Pré-requisitos: Java 25, Node 22+ (`npm ci` na raiz do workspace) e Docker.

```bash
npm ci
```

```bash
GOOGLE_CLOUD_PROJECT=fiap-challenge-ford npm exec -- nx run api:bootRun
```

- O suporte a Docker Compose do Spring Boot sobe o PostgreSQL definido em
  `compose.yaml`, na raiz do workspace, e o Flyway aplica as migrações de
  `src/main/resources/db/migration`.
- A API escuta em `http://localhost:8080`.
- O Swagger UI fica em `http://localhost:8080/swagger-ui.html` e o documento
  OpenAPI em `http://localhost:8080/v3/api-docs`. Os dois são públicos.
- `GOOGLE_CLOUD_PROJECT` (ou `SPECSYNC_AUTH_FIREBASE_PROJECT_ID`) indica o
  projeto do Identity Platform cujos tokens são aceitos. Sem essa variável,
  todo token de usuário é recusado (a API falha de forma fechada).

Recursos opcionais, todos desligados por padrão e configurados por variáveis de
ambiente (veja `src/main/resources/application.properties`):

| Variável                                          | Habilita                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `SPECSYNC_INGESTION_ENABLED=true`                 | endpoints de ingestão e ontologia da curadoria (sem ela, respondem 403) |
| `SPECSYNC_CREDITS_SERVICE_KEY` (≥ 32 caracteres)  | endpoints internos de créditos de IA                                    |
| `SPECSYNC_RESEARCH_SERVICE_KEY` (≥ 32 caracteres) | endpoints internos de pesquisa                                          |

Para rodar o produto completo (navegador → gateway → API/IA), siga
[`apps/gateway/README.md`](../gateway/README.md#local-development) e abra
`http://localhost:4200`.

## Autenticação e autorização

O **gateway autentica**: ele verifica o login do usuário com o Google (ID token
do Identity Platform). A **API apenas autoriza**: ela valida novamente esse JWT
e decide o acesso a partir das suas claims. A API não tem login, não guarda
senhas e não emite tokens. Veja a
[ADR-0004](docs/adr/0004-gateway-authenticates-api-authorises.md).

| Verificação em todo token de usuário                                    | Falha                                              |
| ----------------------------------------------------------------------- | -------------------------------------------------- |
| Assinatura RS256 com as chaves públicas do Google (JWKS, em cache)      | 401 `invalid_token`                                |
| `iss` = `https://securetoken.google.com/<projeto>`, `aud` = `<projeto>` | 401 `invalid_token`                                |
| `exp` no futuro, `nbf`/`iat` não no futuro (tolerância de 60 s)         | 401 `invalid_token` (`reason` informa que expirou) |
| `sub` presente                                                          | 401 `invalid_token`                                |

| Perfil    | Concedido por                     | Permite                                               |
| --------- | --------------------------------- | ----------------------------------------------------- |
| anônimo   | sem token                         | leituras públicas do catálogo, documentação da API    |
| `USER`    | qualquer token válido             | + `GET /api/me`                                       |
| `CURATOR` | custom claim `roles: ["curator"]` | + `/api/ingestions/**`, `/api/ontology/**`            |
| `ADMIN`   | `roles: ["admin"]`                | tudo o que um curador pode (`ADMIN > CURATOR > USER`) |

Os papéis são atribuídos por um operador. Depois da mudança, o usuário precisa
entrar novamente:

```bash
node apps/gateway/ops/set-user-roles.mjs fiap-challenge-ford <uid> curator
```

### Chamando a API diretamente com um token

1. Rode o web app e o gateway localmente (ou abra o app publicado) e entre com
   o Google.
2. Nas ferramentas de desenvolvedor do navegador, abra _Session storage_ e
   procure a chave `firebase:authUser:<apiKey>:[DEFAULT]`. Copie
   `stsTokenManager.accessToken`: esse é o ID token (válido por uma hora).
3. Envie-o como bearer token, ou cole-o no **Authorize** → `userToken` do
   Swagger UI:

```bash
curl -i http://localhost:8080/api/me -H "Authorization: Bearer $ID_TOKEN"
```

```json
{
  "uid": "…",
  "email": "…",
  "roles": ["CURATOR", "USER"],
  "expiresAt": "2026-09-27T14:03:11Z"
}
```

Os endpoints internos (`/api/internal/**`) são exclusivos de outros serviços. O
serviço de IA se autentica com chaves de serviço por superfície, e o Cloud
Scheduler com um token OIDC do Google. Esses fluxos estão descritos na
arquitetura da solução.

## Endpoints

Todo endpoint é um recurso sob `/api` e usa os verbos HTTP conforme sua
semântica: `GET` lê e é seguro, `POST` cria ou dispara uma transição de estado,
`PUT` substitui um sub-recurso de forma idempotente e `DELETE` remove. Cada
resultado tem seu próprio status code. As decisões de revisão (`publish`,
`reject`, `activate`) são modeladas como `POST` em um sub-recurso de transição,
porque cada uma registra uma decisão auditada em vez de sobrescrever o recurso.

### Públicos

| Método | Caminho                                                            | Sucesso | Erros    |
| ------ | ------------------------------------------------------------------ | ------- | -------- |
| GET    | `/api/vehicle-configurations?q=&market=&modelYear=&limit=&offset=` | 200     | 400, 422 |
| GET    | `/api/comparison-attributes`                                       | 200     | —        |
| GET    | `/api/comparisons?configurationIds=…&attributes=…`                 | 200     | 400, 422 |
| GET    | `/api/vehicle-specifications?configurationId=…`                    | 200     | 400, 422 |
| GET    | `/api/greeting?name=`                                              | 200     | 400, 422 |

### Usuário (`USER`, qualquer token válido)

| Método | Caminho   | Sucesso                                | Erros |
| ------ | --------- | -------------------------------------- | ----- |
| GET    | `/api/me` | 200 com o chamador descrito pelo token | 401   |

### Curadoria (`CURATOR` ou `ADMIN`)

| Método | Caminho                                 | Sucesso                                    | Erros              |
| ------ | --------------------------------------- | ------------------------------------------ | ------------------ |
| POST   | `/api/ingestions`                       | **201** + `Location: /api/ingestions/{id}` | 400, 401, 403, 422 |
| GET    | `/api/ingestions`                       | 200                                        | 401, 403           |
| GET    | `/api/ingestions/{id}`                  | 200                                        | 401, 403, 422      |
| GET    | `/api/ingestions/{id}/source`           | 200 `application/octet-stream`             | 401, 403, 422      |
| POST   | `/api/ingestions/{id}/publish`          | 200                                        | 400, 401, 403, 422 |
| POST   | `/api/ingestions/{id}/reject`           | 200                                        | 401, 403, 422      |
| GET    | `/api/ontology/proposals`               | 200                                        | 401, 403           |
| POST   | `/api/ontology/proposals/{id}/activate` | 200                                        | 400, 401, 403, 422 |

### Internos (credenciais de serviço)

| Método       | Caminho                                                        | Chamador        | Sucesso                               | Erros                   |
| ------------ | -------------------------------------------------------------- | --------------- | ------------------------------------- | ----------------------- |
| GET          | `/api/internal/ai-credits/wallets/{uid}`                       | IA              | 200                                   | 401                     |
| GET          | `/api/internal/ai-credits/tariffs`                             | IA              | 200                                   | 401                     |
| POST         | `/api/internal/ai-credits/wallets/{uid}/runs`                  | IA              | 200 (idempotente por run id)          | 400, 401, 402, 409, 422 |
| POST         | `/api/internal/ai-credits/wallets/{uid}/runs/{runId}/usage`    | IA              | 200 (idempotente por etapa)           | 400, 401, 404, 409      |
| POST         | `/api/internal/ai-credits/wallets/{uid}/runs/{runId}/finish`   | IA              | 200                                   | 400, 401, 404           |
| POST         | `/api/internal/research/users/{uid}/requests`                  | IA              | 200 (cria ou entra no trabalho comum) | 400, 401, 422           |
| GET          | `/api/internal/research/users/{uid}/requests[/{id}]`           | IA              | 200                                   | 401, 422                |
| DELETE       | `/api/internal/research/users/{uid}/requests/{id}`             | IA              | 200 (desvincula este usuário)         | 401, 422                |
| POST/GET/PUT | `/api/internal/research/works/{workId}/attempts/{attemptId}/…` | worker de IA    | 200                                   | 400, 401, 422           |
| POST         | `/api/internal/ingestion/drain`                                | Cloud Scheduler | 200                                   | 401                     |

Rota inexistente: 404. Método não suportado: 405. Tipo de mídia não suportado: 415.

## Erros

Todo erro é um problem da RFC 9457 (`application/problem+json`) com o mesmo
formato, venha ele do Spring Security, da validação ou do domínio:

```json
{
  "type": "about:blank",
  "title": "Forbidden",
  "status": 403,
  "detail": "The curator role is required",
  "instance": "/api/ingestions"
}
```

Os problems de validação (400) e de regra de negócio (422) incluem
`"errors": [{"property": "…", "message": "…"}]`. Um token recusado (401) inclui
`"reason"` e o header `WWW-Authenticate: Bearer error="invalid_token"`. Falhas
inesperadas devolvem um 500 genérico, sem detalhes internos. A tabela completa
de status está na [ADR-0003](docs/adr/0003-error-handling-at-the-edge.md).

## Testes

```bash
npm exec -- nx run api:test
```

O comando executa 204 testes: testes de domínio e de casos de uso (JUnit puro),
testes de fatia dos controllers com o Spring Security real e JWTs realmente
assinados, testes de integração JDBC em H2, um teste com o contexto completo e
as regras de arquitetura do ArchUnit. O console mostra cada teste e um resumo
final. O relatório HTML fica em `build/reports/tests/test/index.html`. A última
execução está registrada em [`docs/test-evidence.md`](docs/test-evidence.md).

Verificações rápidas (também executadas nos git hooks):

```bash
npm exec -- nx run api:spotlessCheck
```

```bash
npm exec -- nx run api:archTest
```

## Entregas da Sprint 3

| Critério                                                                               | Onde                                                                                                                           |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Arquitetura da solução: componentes, responsabilidades, fluxo de comunicação e de auth | [`docs/architecture/solution-architecture.md`](../../docs/architecture/solution-architecture.md)                               |
| Autenticação e autorização: endpoints públicos e protegidos, perfis                    | `verifyIdToken` no gateway; `SecurityConfiguration`, `IngestionConfiguration`; tabela de perfis acima                          |
| Maturidade REST nível 2: recursos, verbos, status codes                                | Tabelas de endpoints acima; `IngestionApi` (201 + `Location`), testes de 400/401/403/405/422                                   |
| Testes automatizados: sucesso, erro e acesso não autorizado                            | `AuthorizationWebMvcTest`, `UserTokenValidationTest`, testes dos controllers; [`docs/test-evidence.md`](docs/test-evidence.md) |
| JWT: validação, proteção dos recursos, expiração, uso das claims                       | `SecurityConfiguration.userTokenDecoder` / `userTokenValidator` / `userTokenConverter`; `GET /api/me`                          |
| Documentação e tratamento de erros: OpenAPI, erros padronizados, README                | `/swagger-ui.html`, `OpenApiConfiguration`, `ProblemResponses`, `GlobalExceptionHandler`, este README                          |
