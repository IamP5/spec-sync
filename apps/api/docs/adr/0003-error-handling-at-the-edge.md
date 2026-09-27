# ADR-0003: Tratamento de erros na borda

- Status: aceita
- Data: 2026-09-04

## Contexto

A primeira versão do endpoint de greeting validava o nome dentro do controller e
lançava `ResponseStatusException`. Isso acopla regras de negócio ao HTTP e não
pode ser reaproveitado por um consumidor de mensagens ou por um segundo
endpoint.

## Decisão

- As invariantes de negócio ficam no domínio. `AssertionConcern` lança uma
  `DomainException` com uma lista de `Error(property, message)`.
  `DomainException` estende `NoStacktraceException`: é controle de fluxo, não um
  defeito, então nenhum stack trace é capturado.
- Controllers e casos de uso nunca capturam `DomainException`. O único
  `@RestControllerAdvice`, o `GlobalExceptionHandler` em
  `infrastructure.configuration`, a converte em HTTP 422 como um
  `ProblemDetail` da RFC 9457, com a propriedade `errors` listando as
  propriedades que falharam.
- A validação estrutural do payload HTTP (campos obrigatórios, formatos) usa
  Bean Validation nos records de request e gera HTTP 400 pelo tratamento padrão
  do Spring. Ela nunca substitui as invariantes do domínio.
- "Não encontrado" é expresso com `DomainException.notFound(aggregate, id)`.
  Mapear isso para 404 é uma decisão a tomar no `GlobalExceptionHandler` quando
  surgir o primeiro endpoint de consulta, e nunca inspecionando o texto das
  mensagens.

## Consequências

- O app Angular recebe um único formato de erro para toda falha de negócio.
- Um novo tipo de falha exige apenas um subtipo de exceção de domínio e um
  método de handler; os controllers não mudam.

## Adendo (2026-09-27): um único formato de erro para todos os status

Todo corpo de erro é um `ProblemDetail` da RFC 9457 (`application/problem+json`)
com `type`, `title`, `status`, `detail` e `instance`. Quando propriedades
falham, ele também traz `errors: [{property, message}]`.

| Status          | Gerado por                                                      | Observações                                                                                                         |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 400             | Bean Validation, JSON malformado, parâmetro ausente ou inválido | `errors` lista os campos que falharam (`GlobalExceptionHandler.handleMethodArgumentNotValid`)                       |
| 401             | Spring Security, antes de qualquer controller                   | `ProblemResponses.unauthorized`; `WWW-Authenticate: Bearer`, mais `reason` quando um token apresentado foi recusado |
| 402             | `InsufficientCreditsException`                                  | traz `code`, `available`, `minimumCharge`, `cheaperModels`                                                          |
| 403             | Spring Security (role ausente)                                  | `ProblemResponses.forbidden`                                                                                        |
| 404             | `CreditRunNotFoundException`, rota inexistente                  |                                                                                                                     |
| 405 / 406 / 415 | Spring MVC                                                      | padrões do `ResponseEntityExceptionHandler`                                                                         |
| 409             | conflitos de `CreditRun*`                                       |                                                                                                                     |
| 422             | `DomainException` e subtipos                                    | invariante de negócio violada                                                                                       |
| 500             | qualquer falha inesperada                                       | registrada em log; o corpo nunca expõe detalhes internos                                                            |
