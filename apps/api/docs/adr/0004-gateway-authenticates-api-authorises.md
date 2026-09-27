# ADR-0004: O gateway autentica, a API autoriza

- Status: aceita
- Data: 2026-09-27

## Contexto

O navegador já faz login com o Google pelo Identity Platform, e o gateway
(`apps/gateway`) verifica o ID token de toda requisição antes de encaminhar
qualquer coisa. A API, porém, não usava essa identidade. Os endpoints de
curadoria eram protegidos por um segredo compartilhado (`X-Ingestion-Key`) que o
curador digitava na interface web. O gateway removia o header `Authorization` e
repassava um header `x-specsync-user` que ninguém verificava, e a API não tinha
nenhum conceito de roles. Na prática, havia três mecanismos para autenticar
pessoas e nenhum modelo de autorização.

## Decisão

- **A autenticação pertence ao gateway.** Ele verifica o ID token do Identity
  Platform (assinatura, expiração, audience, issuer, revogação, usuário
  desativado, e-mail Google verificado) e repassa o mesmo token à API como
  `Authorization: Bearer <JWT>`. O IAM do Cloud Run continua usando
  `X-Serverless-Authorization`, então os dois headers nunca se sobrepõem.
- **A API é um resource server OAuth 2.0 que apenas autoriza.** O
  `oauth2ResourceServer().jwt()` do Spring Security valida o JWT repassado:
  assinatura RS256 contra o JWKS securetoken do Google (buscado sob demanda e
  mantido em cache), issuer `https://securetoken.google.com/<projeto>`, audience
  `<projeto>`, `exp`/`nbf` com tolerância de 60 s e um `sub` preenchido. Em
  seguida, converte as claims em authorities: `sub` é o principal e `roles` vira
  `ROLE_CURATOR`/`ROLE_ADMIN`, além de um `ROLE_USER` implícito. A API não tem
  endpoint de login, não guarda senhas e não emite tokens de usuário.
- **As roles ficam nas custom claims do Identity Platform** e são atribuídas
  por operadores com `apps/gateway/ops/set-user-roles.mjs`. A hierarquia
  `ADMIN > CURATOR > USER` é declarada em um único lugar
  (`SecurityConfiguration.roleHierarchy`).
- **As regras de acesso são por URL e ficam em `infrastructure.configuration`.**
  Leituras `GET` do catálogo e a documentação da API são públicas, `/api/me`
  exige `USER`, `/api/ingestions/**` e `/api/ontology/**` exigem `CURATOR`, e
  todo o resto exige autenticação. Os controllers não têm código de segurança;
  eles só leem o principal verificado (`Principal`,
  `@AuthenticationPrincipal Jwt`) para registrar quem agiu.
- **A chave compartilhada de curador foi aposentada.** A fila de importações da
  curadoria continua compartilhada (`Ingestion.CURATOR_WORKSPACE`), e cada
  publicação registra o uid do curador como revisor.
- **As chamadas entre máquinas mantêm credenciais de serviço.** As chamadas de
  créditos e de pesquisa do serviço de IA usam bearer keys por superfície; o
  Cloud Scheduler usa um token OIDC do Google. Esses chamadores agem pelo
  sistema, não por uma pessoa, não passam pelo gateway e duram mais que um
  token de usuário de uma hora (uma pesquisa pode levar até 20 minutos depois do
  pedido do usuário).
- **401 e 403 são problems da RFC 9457** (`ProblemResponses`), com o desafio
  `WWW-Authenticate: Bearer` da RFC 6750, que traz `error="invalid_token"`
  quando um token foi apresentado e recusado.

## Alternativas consideradas

- _O gateway emitir um JWT próprio de curta duração para a API._ Isso
  desacoplaria a API do Identity Platform, mas exigiria gestão de chaves no
  gateway e colocaria um segundo formato de token no sistema. O ID token já é
  um JWT assinado, com expiração e audience, que carrega as roles.
- _Confiar em `x-specsync-user` atrás do IAM do Cloud Run._ Rejeitada: qualquer
  coisa com permissão de invocar a API poderia se passar por qualquer usuário ou
  role.
- _Manter a chave de curador como alternativa._ Rejeitada: é uma segunda forma
  de autenticar pessoas, é compartilhada entre pessoas e não registra o revisor
  individual.

## Consequências

- Uma mudança de role vale a partir do próximo login do usuário; o script de
  operação revoga os refresh tokens para forçar isso.
- Chamar a API diretamente (Swagger UI, curl) exige um ID token real do
  Identity Platform do projeto configurado; o `apps/api/README.md` explica como
  obtê-lo.
- Os testes assinam JWTs no formato de ID token com uma chave local
  (`TestTokens`) e os passam pelo validador de produção, então expiração,
  falsificação, projeto errado e regras de role são cobertos sem acesso à rede.
