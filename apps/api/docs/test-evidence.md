# Evidência dos testes da API

Resultado da suíte completa da API (testes unitários, de fatia, de integração e
de arquitetura) em 2026-09-27, branch `claude/api-arquitetura-sprint-3-b01d8d`,
Java 25, Spring Boot 4.0.8.

```bash
npm exec -- nx run api:test --skip-nx-cache
```

A task `test` do Gradle imprime uma linha por teste e um resumo final
(`apps/api/build.gradle`), então a saída desse comando no console é o próprio
relatório da execução. O relatório HTML é gerado em
`apps/api/build/reports/tests/test/index.html`.

```text
test: 204 tests, 204 passed, 0 failed, 0 skipped (SUCCESS)
BUILD SUCCESSFUL
```

## O que os testes de segurança comprovam

| Cenário                                                                             | Teste                                                                                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Leitura pública do catálogo sem token → 200                                         | `AuthorizationWebMvcTest.PublicEndpoints`                                                              |
| Documento OpenAPI e Swagger UI servidos sem token                                   | `ApiDocumentationTests`                                                                                |
| Sem token → problem 401 + `WWW-Authenticate: Bearer`                                | `AuthorizationWebMvcTest.Authentication`, `ApiDocumentationTests`                                      |
| Token válido → chamador descrito pelas claims (`sub`, `email`, `roles`, `exp`)      | `AuthorizationWebMvcTest.Authentication`                                                               |
| Token expirado, forjado (chave não confiável), de outro projeto ou malformado → 401 | `AuthorizationWebMvcTest.Authentication`, `UserTokenValidationTest`                                    |
| Token válido sem a role de curador → problem 403                                    | `AuthorizationWebMvcTest.CuratorRole`, `OntologyControllerWebMvcTest`                                  |
| Curador e admin (hierarquia de roles) → 200                                         | `AuthorizationWebMvcTest.CuratorRole`                                                                  |
| Apenas a antiga chave compartilhada de curador → 401                                | `AuthorizationWebMvcTest.CuratorRole`                                                                  |
| `POST /api/ingestions` → 201 + `Location`                                           | `AuthorizationWebMvcTest.CuratorRole`                                                                  |
| Corpo inválido → 400 com `errors[]`; regra de negócio → 422; método errado → 405    | `AuthorizationWebMvcTest.CuratorRole`                                                                  |
| Falha inesperada → 500 genérico, sem detalhes internos                              | `GreetingControllerWebMvcTest`                                                                         |
| Chaves de serviço internas e token do Scheduler: sucesso, 401, chave errada         | `AiCreditsControllerWebMvcTest`, `ResearchControllerWebMvcTest`, `IngestionWorkerControllerWebMvcTest` |
| Claims de roles → roles (`USER` implícito, valores desconhecidos ignorados)         | `RoleTest`, `DefaultGetCurrentCallerTest`, `UserTokenValidationTest`                                   |
| Regras da arquitetura limpa                                                         | `ArchitectureTest` (30 regras do ArchUnit)                                                             |

## Todos os testes da execução

### ArchitectureTest (30)

- ✅ layers_only_depend_inwards
- ✅ domain_is_framework_free
- ✅ application_abstractions_are_framework_free
- ✅ web_does_not_depend_on_application_impl
- ✅ controllers_must_not_call_gateways
- ✅ aggregate_roots_live_with_their_aggregate
- ✅ identifiers_are_records_named_with_Id_suffix
- ✅ domain_ports_are_gateways
- ✅ gateway_ports_live_next_to_their_aggregate
- ✅ events_package_only_holds_domain_events
- ✅ concrete_domain_events_are_records
- ✅ aggregate_event_interfaces_are_sealed
- ✅ service_is_only_on_default_impls
- ✅ top_level_classes_in_impl_are_Default_named
- ✅ default_impls_are_concrete_use_cases
- ✅ use_case_abstractions_extend_a_use_case_base
- ✅ gateway_adapters_implement_a_domain_gateway
- ✅ repository_annotation_only_on_gateway_adapters
- ✅ jpa_entities_live_in_persistence_subpackage
- ✅ spring_data_repositories_live_in_persistence_subpackage
- ✅ persistence_classes_used_only_within_infrastructure
- ✅ persistence_and_cloud_libraries_only_inside_infrastructure
- ✅ rest_controllers_live_in_controllers_package
- ✅ controllers_are_rest_controllers
- ✅ rest_controllers_implement_an_api_interface
- ✅ api_interfaces_live_in_web_api
- ✅ request_dtos_are_records_named_Request
- ✅ response_dtos_are_records_named_Response
- ✅ no_field_injection
- ✅ components_and_configurations_are_adapters

### ApiDocumentationTests (3)

- ✅ servesSwaggerUi()
- ✅ protectsEverythingElseWithAProblem401()
- ✅ publishesTheOpenApiDocumentWithItsSecuritySchemes()

### ApplicationTests (1)

- ✅ contextLoads()

### DefaultGetCurrentCallerTest (1)

- ✅ describesTheCallerWithRolesMostPrivilegedFirst()

### DefaultCompareVehiclesTest (2)

- ✅ validatesSearchAndExposesAttributeDefinitions()
- ✅ validatesBeforeCallingGatewayAndPreservesSelection()

### DefaultCreditsUseCasesTest (11)

- ✅ readsTheWalletTogetherWithTheRateCard()
- ✅ chargesAStepAtTheRateCardAndLowersTheBalance()
- ✅ passesTheReportedTokensThroughUntouched()
- ✅ reportsAnExhaustedWalletAfterTheStepThatUsesItUp()
- ✅ refusesToFinishARunWithAStatusThatIsNotTerminal()
- ✅ refusesToStartARunTheWalletCannotCover()
- ✅ trimsTheUidBeforeItReachesTheWallet()
- ✅ finishesARunAndAnswersWithTheRefreshedWallet()
- ✅ listsTheActiveTariffs()
- ✅ admitsARunAndReportsItsHold()
- ✅ rejectsAWalletRequestWithoutAUid()

### DefaultCreateGreetingTest (2)

- ✅ propagatesDomainErrors()
- ✅ createsGreetingUsingTheHashPort()

### DefaultDrainIngestionTest (3)

- ✅ runsCyclesUntilOneFindsNoWork()
- ✅ reportsNoCyclesForAnEmptyQueue()
- ✅ startsNoNewCycleOnceTheBudgetIsSpent()

### RoleTest (4)

- ✅ callerKnowsItsRoles()
- ✅ callerRequiresAUidAndAnExpiry()
- ✅ grantsUserToEveryCaller()
- ✅ readsKnownClaimsAndIgnoresUnknownOnes()

### CatalogSearchTest (2)

- ✅ boundsEveryFilter()
- ✅ normalizesTextWithoutTreatingWildcardsAsCommands()

### ComparisonSelectionTest (3)

- ✅ rejectsAmbiguousOrUnboundedAttributeSelections()
- ✅ rejectsInvalidConfigurationSelections()
- ✅ preservesOrderAndDefensivelyCopiesSelection()

### CreditAmountTest (4)

- ✅ addsAndSubtractsInMicroCredits()
- ✅ treatsOnlyStrictlyPositiveAmountsAsPositive()
- ✅ allowsNegativeBalancesAfterTheExhaustingStep()
- ✅ picksTheLargerAndTheSmallerAmount()

### CreditsTest (15)

- ✅ treatsANonPositiveAvailableAsExhausted()
- ✅ chargesEveryTermAtItsOwnRate()
- ✅ capsAHoldAtThirtyThousandInputAndEightThousandOutput()
- ✅ rejectsNegativeTokenCounts()
- ✅ offersNoAlternativeWhenNothingFits()
- ✅ readsAvailableAsTheBalanceMinusTheOpenHolds()
- ✅ rejectsAWalletIdThatCouldNotIdentifyAUser()
- ✅ admitsARunThatTheBalanceStillCovers()
- ✅ rejectsARunAndNamesTheModelsThatStillFitCheapestFirst()
- ✅ roundsEveryTermUpSoAChargeNeverUndercutsTheRateCard()
- ✅ holdsEverythingThatIsLeftUpToOneRunsWorth()
- ✅ pricesAMinimumUsefulAnswerAtFourThousandInputAndOneThousandOutput()
- ✅ pricesTheCachedSubsetAtTheCachedRate()
- ✅ chargesNothingForZeroTokens()
- ✅ acceptsOnlyTerminalStatusesToFinishARunWith()

### GreetingTest (3)

- ✅ createsGreetingWithTrimmedNameAndHashAsId()
- ✅ rejectsBlankName()
- ✅ rejectsNameLongerThanMaxLength()

### IngestionTest (9)

- ✅ convertsTorqueWithoutInventingPrecision()
- ✅ readsBrazilianGroupingAndDecimalNotation()
- ✅ recordsAConfigurationReasonWithoutReplacingTheReviewReason()
- ✅ refusesAmbiguousNumbersAndUnits()
- ✅ distinguishesMetricAndMechanicalHorsepower()
- ✅ publishesTheRestOfADraftButNeverAnAttributeTwice()
- ✅ verifiesExactEvidenceBounds()
- ✅ boundsRequestedConfigurations()
- ✅ requiresIdentityConfirmationAndUniqueSelections()

### OntologyTest (6)

- ✅ keepsAmbiguousMappingsUnresolved()
- ✅ retainsOnlyOriginalDocumentLabelsNotLegacyEnglishParaphrases()
- ✅ acceptsTheTwoOriginalLabelReaderRevisionsOnly()
- ✅ resolvesOnlyApplicableManufacturerTerminology()
- ✅ preservesFuelCombinationsAndUsesThePinnedVocabulary()
- ✅ normalizesFordModelSpellingWithoutMergingTrimsOrBrands()

### ResearchTest (8)

- ✅ checkpointBoundsCountUtf8BytesAndRejectUnsafeKeys()
- ✅ distinctQueryPathAndPolicyNeverShareWork()
- ✅ emptyPathAndDefaultPortAreEquivalent()
- ✅ identityCannotBeMissingOrUnbounded()
- ✅ approvedFordWholeModelAliasesShareWorkWithoutRewritingTheRequest()
- ✅ publicSourceHasChecksumsWithoutRawCaptureContent()
- ✅ fordModelAliasDoesNotMergeOtherBrandsYearsOrModelNamesContainingTrims()
- ✅ equivalentScopesIgnoreRequestedTrimAndFragmentButRetainTheExplicitYear()

### UserTokenValidationTest (8)

- ✅ rejectsATokenOfAnotherIdentityPlatformProject()
- ✅ acceptsAValidTokenAndReadsItsClaims()
- ✅ rejectsEveryTokenWhenNoProjectIsConfigured()
- ✅ rejectsAnExpiredToken()
- ✅ mapsTheRolesClaimToAuthoritiesWithAnImplicitUser()
- ✅ rejectsATokenWithoutSubject()
- ✅ rejectsATokenSignedByAnUntrustedKey()
- ✅ rejectsATokenMeantForAnotherAudience()

### CatalogJdbcGatewayIT (8)

- ✅ deliversPublicPrimaryImageThroughSearchSpecificationsAndComparison()
- ✅ expandsOmittedAttributesWithoutLeakingOtherConfigurations()
- ✅ searchesLiteralTextAndPaginatesDeterministically()
- ✅ omitsImagesOutsidePublicVehicleStorageWithoutHidingTheConfiguration()
- ✅ rejectsUnknownSelectionsInsteadOfReturningPartialComparisons()
- ✅ hidesSupersededConfigurationsAndRejectsTheirIds()
- ✅ returnsOrderedCompleteMatrixWithUnresolvedConflicts()
- ✅ preservesPrecisionOptionalityAndEvidence()

### CreditsJdbcGatewayIT (20)

- ✅ listsOnlyActiveTariffs()
- ✅ refusesToStartARunUnderARunIdAnotherWalletAlreadyOwns()
- ✅ refusesToChargeAStepOfAFinishedRun()
- ✅ refusesToChargeAStepOfAnUnknownRun()
- ✅ admitsTheSecondRunOnlyWithinWhatTheFirstHoldLeaves()
- ✅ stopsCountingAHoldOnceItExpired()
- ✅ recordsAStepThatPricesAtNothingWithoutPostingALedgerEntry()
- ✅ refusesToStartARunOnAModelWithoutAnActiveTariff()
- ✅ keepsTheFirstOutcomeWhenAFinishIsReplayed()
- ✅ grantsTheSignupCreditsOnceHoweverOftenTheWalletIsTouched()
- ✅ chargesEveryDistinctStepOfTheSameRun()
- ✅ neverTurnsAHoldIntoACreditWhenAStepCostsMoreThanItReserved()
- ✅ keepsAnyRunIdIdempotentEvenWhenItIsNotAUuid()
- ✅ chargesAStepAndShrinksTheRunsHold()
- ✅ returnsTheExistingRunWhenAdmissionIsReplayed()
- ✅ replaysAStepThatPricesAtNothing()
- ✅ releasesTheHoldWhenARunFinishes()
- ✅ admitsARunAndHoldsOneRunsWorthOfCredits()
- ✅ replaysAStepWithoutChargingItTwice()
- ✅ refusesToStartARunWhenLessIsLeftThanAMinimumAnswerCosts()

### GoogleCloudRunClientTest (2)

- ✅ rejectsInsecureWorkerOriginsBeforeObtainingCredentials()
- ✅ localDevelopmentPreservesWorkerCredentialsWithoutAccessingAdc()

### IngestionSerializationTest (3)

- ✅ retainsAnOlderPinnedContextWithoutAddingCurrentVocabulary()
- ✅ readsLegacyPersistedDraftsWithoutOntologyMetadataOrUnmappedObservations()
- ✅ readsDecisionsPublishedBeforeConfigurationReasonsExisted()

### AiCreditsControllerWebMvcTest (12)

- ✅ rejectsARunRequestWithoutAModel()
- ✅ answersNotFoundForAStepOfAnUnknownRun()
- ✅ returnsTheRateCardWithoutAffordability()
- ✅ answersConflictForAStepOfAFinishedRun()
- ✅ answersPaymentRequiredWithTheCheaperModelsWhenCreditsDoNotCoverTheRun()
- ✅ returnsTheHoldOfAnAdmittedRun()
- ✅ returnsTheChargeOfAStep()
- ✅ rejectsARequestWithTheWrongServiceKey()
- ✅ rejectsARequestWithoutTheBearerScheme()
- ✅ rejectsARequestWithoutTheServiceKey()
- ✅ returnsTheWalletViewForTheServiceKey()
- ✅ returnsTheWalletViewWhenARunFinishes()

### AuthorizationWebMvcTest (17)

- ✅ Authentication > rejectsAnExpiredTokenAsInvalid()
- ✅ Authentication > rejectsAForgedToken()
- ✅ Authentication > rejectsATokenOfAnotherProject()
- ✅ Authentication > describesTheCallerFromAValidToken()
- ✅ Authentication > listsEveryEffectiveRoleMostPrivilegedFirst()
- ✅ Authentication > rejectsAMalformedToken()
- ✅ Authentication > answersProblem401WithBearerChallengeWithoutToken()
- ✅ PublicEndpoints > apiDocumentationNeedsNoToken()
- ✅ PublicEndpoints > catalogReadsNeedNoToken()
- ✅ CuratorRole > createsAnImportWith201AndItsLocation()
- ✅ CuratorRole > answers405ForAnUnsupportedMethod()
- ✅ CuratorRole > rejectsAnIncompleteBodyWith400AndTheFailedProperties()
- ✅ CuratorRole > letsAnAdminDoWhatACuratorMay()
- ✅ CuratorRole > mapsABusinessRuleViolationTo422()
- ✅ CuratorRole > refusesTheRetiredSharedCuratorKey()
- ✅ CuratorRole > refusesAUserWithoutTheCuratorRole()
- ✅ CuratorRole > letsACuratorListTheSharedQueue()

### CatalogControllerWebMvcTest (6)

- ✅ exposesPublicSearchWithDefaults()
- ✅ rejectsMalformedOrMissingIdsBeforeUseCase()
- ✅ reportsSelectionErrorsAsProblemDetails()
- ✅ keepsUnrelatedRoutesProtected()
- ✅ exposesPublicAttributeDefinitions()
- ✅ bindsOrderedIdsAndAttributeCodes()

### GreetingControllerWebMvcTest (4)

- ✅ answersMissingParameterWith400Problem()
- ✅ returnsGreetingResponse()
- ✅ mapsDomainExceptionToUnprocessableEntity()
- ✅ hidesUnexpectedFailuresBehindAGeneric500Problem()

### IngestionWorkerControllerWebMvcTest (5)

- ✅ rejectsAnotherServiceAccount()
- ✅ rejectsAnUnverifiedEmail()
- ✅ rejectsARequestWithoutAToken()
- ✅ rejectsATokenThatFailsVerification()
- ✅ drainsTheQueueForTheSchedulerServiceAccount()

### OntologyControllerWebMvcTest (3)

- ✅ requiresTheCuratorRoleForEveryOntologySurface()
- ✅ rejectsMissingReviewReasonBeforeCallingTheUseCase()
- ✅ recordsTheCuratorUidAsReviewerOfTheExactRevision()

### ResearchControllerWebMvcTest (9)

- ✅ rejectsAnUnsafeCheckpointKeyBeforeCallingTheUseCase()
- ✅ createsWithTheTrustedPathIdentityAndReturnsAFlatSafeSnapshot()
- ✅ listsOnlyTheTrustedUsersRequests()
- ✅ replayUsesTheTrustedUserAndNewPrivateRequestIdentity()
- ✅ cancellationUsesPrivateRequestIdentity()
- ✅ rejectsMissingRequestIdentityBeforeCallingTheUseCase()
- ✅ rejectsEveryPrivateSurfaceWithoutTheServiceKey()
- ✅ passesAttemptIdentityToHeartbeatAndOpaqueCheckpoint()
- ✅ rejectsWrongKeyAndReviewerHeader()
