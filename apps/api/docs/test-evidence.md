# API test evidence

Result of the full API suite (unit, slice, integration and architecture tests) on
2026-09-27, branch `claude/api-arquitetura-sprint-3-b01d8d`, Java 25, Spring Boot 4.0.8.

```bash
npm exec -- nx run api:test --skip-nx-cache
```

The Gradle `test` task prints one line per test and a final summary
(`apps/api/build.gradle`), so the console output of that command is the execution
report. The HTML report is written to `apps/api/build/reports/tests/test/index.html`.

```text
test: 204 tests, 204 passed, 0 failed, 0 skipped (SUCCESS)
BUILD SUCCESSFUL
```

## What the security tests prove

| Scenario                                                                        | Test                                                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Public catalog read without a token → 200                                       | `AuthorizationWebMvcTest.PublicEndpoints`                                                              |
| OpenAPI document and Swagger UI served without a token                          | `ApiDocumentationTests`                                                                                |
| No token → 401 problem + `WWW-Authenticate: Bearer`                             | `AuthorizationWebMvcTest.Authentication`, `ApiDocumentationTests`                                      |
| Valid token → caller described from its claims (`sub`, `email`, `roles`, `exp`) | `AuthorizationWebMvcTest.Authentication`                                                               |
| Expired, forged (untrusted key), other project, malformed token → 401           | `AuthorizationWebMvcTest.Authentication`, `UserTokenValidationTest`                                    |
| Valid token without the curator role → 403 problem                              | `AuthorizationWebMvcTest.CuratorRole`, `OntologyControllerWebMvcTest`                                  |
| Curator and admin (role hierarchy) → 200                                        | `AuthorizationWebMvcTest.CuratorRole`                                                                  |
| Retired shared curator key alone → 401                                          | `AuthorizationWebMvcTest.CuratorRole`                                                                  |
| `POST /api/ingestions` → 201 + `Location`                                       | `AuthorizationWebMvcTest.CuratorRole`                                                                  |
| Invalid body → 400 with `errors[]`; business rule → 422; wrong method → 405     | `AuthorizationWebMvcTest.CuratorRole`                                                                  |
| Unexpected failure → generic 500 without internals                              | `GreetingControllerWebMvcTest`                                                                         |
| Internal service keys and scheduler token: success, 401, wrong key              | `AiCreditsControllerWebMvcTest`, `ResearchControllerWebMvcTest`, `IngestionWorkerControllerWebMvcTest` |
| Role claims → roles (implicit `USER`, unknown ignored)                          | `RoleTest`, `DefaultGetCurrentCallerTest`, `UserTokenValidationTest`                                   |
| Clean-architecture rules                                                        | `ArchitectureTest` (30 ArchUnit rules)                                                                 |

## Every test of the run

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
