package com.fiap.ford.specsync.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noFields;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

import com.fiap.ford.specsync.application.NullaryUseCase;
import com.fiap.ford.specsync.application.UnitUseCase;
import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.shared.AggregateRoot;
import com.fiap.ford.specsync.domain.shared.DomainEvent;
import com.fiap.ford.specsync.domain.shared.Identifier;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTag;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RestController;

/**
 * Deterministic enforcement of the clean architecture documented in
 * {@code apps/api/docs/architecture-boundaries.md}. Every rule carries a {@code because(...)} that
 * names the convention, so a failure explains why, not only what.
 *
 * <p>Tagged {@code architecture} so {@code nx run api:archTest} can run only these rules after
 * every agent round and before every commit. ArchUnit's JUnit engine only reports {@link ArchTag}
 * tags (a plain JUnit {@code @Tag} is invisible to it and the task would silently run nothing).
 */
@ArchTag("architecture")
@AnalyzeClasses(packages = "com.fiap.ford.specsync", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    private static final String BASE = "com.fiap.ford.specsync";
    private static final String DOMAIN = BASE + ".domain..";
    private static final String DOMAIN_SHARED = BASE + ".domain.shared..";
    private static final String DOMAIN_EXCEPTIONS = BASE + ".domain.exceptions..";
    private static final String DOMAIN_VALIDATION = BASE + ".domain.validation..";
    private static final String DOMAIN_EVENTS = BASE + ".domain..events..";
    private static final String APPLICATION = BASE + ".application..";
    private static final String APPLICATION_IMPL = BASE + ".application..impl..";
    private static final String INFRASTRUCTURE = BASE + ".infrastructure..";
    private static final String INFRA_GATEWAY = BASE + ".infrastructure.gateway..";
    private static final String INFRA_PERSISTENCE = BASE + ".infrastructure.gateway..persistence..";
    private static final String WEB = BASE + ".web..";
    private static final String WEB_API = BASE + ".web.api..";
    private static final String WEB_CONTROLLERS = BASE + ".web.controllers..";
    private static final String WEB_DTO_REQUEST = BASE + ".web.dto.request..";
    private static final String WEB_DTO_RESPONSE = BASE + ".web.dto.response..";

    // ------------------------------------------------------------------
    // 1. Layer dependencies (ADR-0001)
    // ------------------------------------------------------------------

    @ArchTest
    static final ArchRule layers_only_depend_inwards = layeredArchitecture()
            .consideringOnlyDependenciesInLayers()
            .layer("domain")
            .definedBy(DOMAIN)
            .layer("application")
            .definedBy(APPLICATION)
            .layer("infrastructure")
            .definedBy(INFRASTRUCTURE)
            .layer("web")
            .definedBy(WEB)
            .whereLayer("web")
            .mayNotBeAccessedByAnyLayer()
            .whereLayer("infrastructure")
            .mayNotBeAccessedByAnyLayer()
            .whereLayer("application")
            .mayOnlyBeAccessedByLayers("web", "infrastructure")
            .whereLayer("domain")
            .mayOnlyBeAccessedByLayers("application", "web", "infrastructure")
            .because("dependencies point inwards: web/infrastructure -> application -> domain");

    @ArchTest
    static final ArchRule domain_is_framework_free = noClasses()
            .that()
            .resideInAPackage(DOMAIN)
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage("org.springframework..", "jakarta..", "com.google..", "lombok..", "com.fasterxml..")
            .because("domain is the kernel: only java.* and itself");

    @ArchTest
    static final ArchRule application_abstractions_are_framework_free = noClasses()
            .that()
            .resideInAPackage(APPLICATION)
            .and()
            .resideOutsideOfPackage(APPLICATION_IMPL)
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage("org.springframework..", "jakarta..", "com.google..", "lombok..")
            .because("use-case abstractions are plain Java; only Default* impls may carry Spring annotations");

    @ArchTest
    static final ArchRule web_does_not_depend_on_application_impl = noClasses()
            .that()
            .resideInAPackage(WEB)
            .should()
            .dependOnClassesThat()
            .resideInAPackage(APPLICATION_IMPL)
            .because("depend on the use-case abstraction; Spring resolves the single Default* impl by type");

    @ArchTest
    static final ArchRule controllers_must_not_call_gateways = noClasses()
            .that()
            .resideInAPackage(WEB_CONTROLLERS)
            .should()
            .dependOnClassesThat()
            .haveSimpleNameEndingWith("Gateway")
            .because("controllers depend on use cases, never directly on a *Gateway port");

    // ------------------------------------------------------------------
    // 2. Domain conventions (ADR-0002)
    // ------------------------------------------------------------------

    @ArchTest
    static final ArchRule aggregate_roots_live_with_their_aggregate = classes()
            .that()
            .areAssignableTo(AggregateRoot.class)
            .and()
            .doNotHaveSimpleName("AggregateRoot")
            .should()
            .resideInAPackage(DOMAIN)
            .andShould()
            .resideOutsideOfPackages(DOMAIN_SHARED, DOMAIN_EXCEPTIONS, DOMAIN_VALIDATION, DOMAIN_EVENTS)
            .allowEmptyShould(true)
            .because("aggregate roots live in domain.<aggregate>, not in shared/exceptions/validation/events");

    @ArchTest
    static final ArchRule identifiers_are_records_named_with_Id_suffix = classes()
            .that()
            .implement(Identifier.class)
            .should()
            .beRecords()
            .andShould()
            .haveSimpleNameEndingWith("Id")
            .allowEmptyShould(true)
            .because("identifiers are records named <Aggregate>Id implementing Identifier");

    @ArchTest
    static final ArchRule domain_ports_are_gateways = noClasses()
            .that()
            .resideInAPackage(DOMAIN)
            .and()
            .areInterfaces()
            .should()
            .haveSimpleNameEndingWith("Repository")
            .because("'*Repository' is reserved for Spring Data; domain ports are named '*Gateway'");

    @ArchTest
    static final ArchRule gateway_ports_live_next_to_their_aggregate = classes()
            .that()
            .resideInAPackage(DOMAIN)
            .and()
            .areInterfaces()
            .and()
            .haveSimpleNameEndingWith("Gateway")
            .should()
            .resideOutsideOfPackages(DOMAIN_SHARED, DOMAIN_EXCEPTIONS, DOMAIN_VALIDATION, DOMAIN_EVENTS)
            .allowEmptyShould(true)
            .because("domain ports live in domain.<aggregate>, not in the kernel");

    @ArchTest
    static final ArchRule events_package_only_holds_domain_events = classes()
            .that()
            .resideInAPackage(DOMAIN_EVENTS)
            .and()
            .areTopLevelClasses()
            .should()
            .beAssignableTo(DomainEvent.class)
            .allowEmptyShould(true)
            .because("everything in domain.<aggregate>.events is a DomainEvent: sealed parent or concrete event");

    @ArchTest
    static final ArchRule concrete_domain_events_are_records = classes()
            .that()
            .resideInAPackage(DOMAIN_EVENTS)
            .and()
            .areTopLevelClasses()
            .and()
            .areNotInterfaces()
            .should()
            .beRecords()
            .allowEmptyShould(true)
            .because("concrete events are immutable records implementing the sealed parent");

    @ArchTest
    static final ArchRule aggregate_event_interfaces_are_sealed = classes()
            .that()
            .resideInAPackage(DOMAIN_EVENTS)
            .and()
            .areInterfaces()
            .and()
            .haveSimpleNameEndingWith("Event")
            .should(beSealed())
            .allowEmptyShould(true)
            .because("event families are sealed so every consumer switch stays exhaustive");

    // ------------------------------------------------------------------
    // 3. Application conventions (ADR-0002)
    // ------------------------------------------------------------------

    @ArchTest
    static final ArchRule service_is_only_on_default_impls = classes()
            .that()
            .areAnnotatedWith(Service.class)
            .should()
            .resideInAPackage(APPLICATION_IMPL)
            .andShould()
            .haveSimpleNameStartingWith("Default")
            .allowEmptyShould(true)
            .because("@Service belongs only on Default* use-case impls");

    @ArchTest
    static final ArchRule top_level_classes_in_impl_are_Default_named = classes()
            .that()
            .resideInAPackage(APPLICATION_IMPL)
            .and()
            .areTopLevelClasses()
            .should()
            .haveSimpleNameStartingWith("Default")
            .allowEmptyShould(true)
            .because("application.<aggregate>.impl holds Default<UseCase> classes only");

    @ArchTest
    static final ArchRule default_impls_are_concrete_use_cases = classes()
            .that()
            .resideInAPackage(APPLICATION_IMPL)
            .and()
            .areTopLevelClasses()
            .and()
            .haveSimpleNameStartingWith("Default")
            .should()
            .notBeInterfaces()
            .andShould(notBeAbstract())
            .andShould(extendOneOf(UseCase.class, NullaryUseCase.class, UnitUseCase.class))
            .allowEmptyShould(true)
            .because("Default* is the concrete implementation of the matching abstract use case");

    @ArchTest
    static final ArchRule use_case_abstractions_extend_a_use_case_base = classes()
            .that()
            .resideInAPackage(APPLICATION)
            .and()
            .resideOutsideOfPackage(APPLICATION_IMPL)
            .and()
            .areTopLevelClasses()
            .and()
            .haveModifier(JavaModifier.ABSTRACT)
            .and()
            .areNotInterfaces()
            .and()
            .doNotHaveSimpleName("UseCase")
            .and()
            .doNotHaveSimpleName("NullaryUseCase")
            .and()
            .doNotHaveSimpleName("UnitUseCase")
            .should(extendOneOf(UseCase.class, NullaryUseCase.class, UnitUseCase.class))
            .allowEmptyShould(true)
            .because("every use-case abstraction extends UseCase, NullaryUseCase or UnitUseCase");

    // ------------------------------------------------------------------
    // 4. Infrastructure conventions (ADR-0002)
    // ------------------------------------------------------------------

    @ArchTest
    static final ArchRule gateway_adapters_implement_a_domain_gateway = classes()
            .that()
            .resideInAPackage(INFRA_GATEWAY)
            .and()
            .areTopLevelClasses()
            .and()
            .haveSimpleNameEndingWith("Gateway")
            .should(implementADomainGateway())
            .allowEmptyShould(true)
            .because("an infrastructure *Gateway is the adapter of exactly one domain *Gateway port");

    @ArchTest
    static final ArchRule repository_annotation_only_on_gateway_adapters = classes()
            .that()
            .areAnnotatedWith(Repository.class)
            .should()
            .resideInAPackage(INFRA_GATEWAY)
            .andShould()
            .haveSimpleNameEndingWith("Gateway")
            .allowEmptyShould(true)
            .because("@Repository tags a persistence adapter under infrastructure.gateway.<aggregate>");

    @ArchTest
    static final ArchRule jpa_entities_live_in_persistence_subpackage = classes()
            .that()
            .areAnnotatedWith("jakarta.persistence.Entity")
            .should()
            .resideInAPackage(INFRA_PERSISTENCE)
            .andShould()
            .haveSimpleNameEndingWith("JpaEntity")
            .allowEmptyShould(true)
            .because("@Entity classes are <Aggregate>JpaEntity under infrastructure.gateway.<aggregate>.persistence");

    @ArchTest
    static final ArchRule spring_data_repositories_live_in_persistence_subpackage = classes()
            .that()
            .areAssignableTo("org.springframework.data.repository.Repository")
            .should()
            .beInterfaces()
            .andShould()
            .haveSimpleNameEndingWith("JpaRepository")
            .andShould()
            .resideInAPackage(INFRA_PERSISTENCE)
            .allowEmptyShould(true)
            .because("Spring Data repositories are <Aggregate>JpaRepository interfaces scoped to persistence");

    @ArchTest
    static final ArchRule persistence_classes_used_only_within_infrastructure = noClasses()
            .that()
            .resideOutsideOfPackage(INFRASTRUCTURE)
            .should()
            .dependOnClassesThat()
            .resideInAPackage(INFRA_PERSISTENCE)
            .because("JPA entities and Spring Data repositories are mapped at the gateway edge only");

    @ArchTest
    static final ArchRule persistence_and_cloud_libraries_only_inside_infrastructure = noClasses()
            .that()
            .resideOutsideOfPackage(INFRASTRUCTURE)
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage(
                    "jakarta.persistence..",
                    "org.springframework.data..",
                    "org.springframework.transaction..",
                    "com.google.cloud..",
                    "org.springframework.ai..",
                    "org.springframework.cloud..")
            .because(
                    "JPA, Spring Data, transactions, Google Cloud, Spring AI and Spring Cloud are infrastructure details");

    // ------------------------------------------------------------------
    // 5. Web conventions (ADR-0002)
    // ------------------------------------------------------------------

    @ArchTest
    static final ArchRule rest_controllers_live_in_controllers_package = classes()
            .that()
            .areAnnotatedWith(RestController.class)
            .should()
            .resideInAPackage(WEB_CONTROLLERS)
            .andShould()
            .haveSimpleNameEndingWith("Controller")
            .allowEmptyShould(true)
            .because("@RestController belongs in web.controllers.<Aggregate>Controller");

    @ArchTest
    static final ArchRule controllers_are_rest_controllers = classes()
            .that()
            .resideInAPackage(WEB_CONTROLLERS)
            .and()
            .areTopLevelClasses()
            .and()
            .haveSimpleNameEndingWith("Controller")
            .should()
            .beAnnotatedWith(RestController.class)
            .allowEmptyShould(true)
            .because("anything called *Controller in web.controllers is a Spring @RestController");

    @ArchTest
    static final ArchRule rest_controllers_implement_an_api_interface = classes()
            .that()
            .areAnnotatedWith(RestController.class)
            .should(implementAnApiInterfaceFrom(WEB_API))
            .allowEmptyShould(true)
            .because("the *Api interface in web.api owns @RequestMapping and the OpenAPI annotations");

    @ArchTest
    static final ArchRule api_interfaces_live_in_web_api = classes()
            .that()
            .resideInAPackage(WEB_API)
            .and()
            .areTopLevelClasses()
            .should()
            .beInterfaces()
            .andShould()
            .haveSimpleNameEndingWith("Api")
            .allowEmptyShould(true)
            .because("HTTP contracts are *Api interfaces in web.api");

    @ArchTest
    static final ArchRule request_dtos_are_records_named_Request = classes()
            .that()
            .resideInAPackage(WEB_DTO_REQUEST)
            .and()
            .areTopLevelClasses()
            .should()
            .haveSimpleNameEndingWith("Request")
            .andShould()
            .beRecords()
            .allowEmptyShould(true)
            .because("inbound DTOs are records named <Verb><Aggregate>Request");

    @ArchTest
    static final ArchRule response_dtos_are_records_named_Response = classes()
            .that()
            .resideInAPackage(WEB_DTO_RESPONSE)
            .and()
            .areTopLevelClasses()
            .should()
            .haveSimpleNameEndingWith("Response")
            .andShould()
            .beRecords()
            .allowEmptyShould(true)
            .because("outbound DTOs are records named <Aggregate>Response with a static from(Output)");

    // ------------------------------------------------------------------
    // 6. General code health
    // ------------------------------------------------------------------

    @ArchTest
    static final ArchRule no_field_injection =
            noFields().should().beAnnotatedWith(Autowired.class).because("constructor injection only");

    @ArchTest
    static final ArchRule components_and_configurations_are_adapters = classes()
            .that()
            .areAnnotatedWith("org.springframework.stereotype.Component")
            .or()
            .areAnnotatedWith("org.springframework.context.annotation.Configuration")
            .should()
            .resideInAnyPackage(INFRASTRUCTURE, WEB)
            .allowEmptyShould(true)
            .because("@Component and @Configuration are adapter concerns; use cases use @Service on Default* only");

    // ------------------------------------------------------------------
    // Custom conditions
    // ------------------------------------------------------------------

    private static ArchCondition<JavaClass> beSealed() {
        return new ArchCondition<>("be sealed (closed permits list)") {
            @Override
            public void check(final JavaClass item, final ConditionEvents events) {
                final boolean sealed;
                try {
                    sealed = Class.forName(item.getName(), false, ArchitectureTest.class.getClassLoader())
                            .isSealed();
                } catch (ClassNotFoundException e) {
                    events.add(SimpleConditionEvent.violated(
                            item, "could not load %s to check sealed: %s".formatted(item.getName(), e)));
                    return;
                }
                if (!sealed) {
                    events.add(
                            SimpleConditionEvent.violated(item, "%s is not sealed".formatted(item.getDescription())));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> notBeAbstract() {
        return new ArchCondition<>("not be abstract") {
            @Override
            public void check(final JavaClass item, final ConditionEvents events) {
                if (item.getModifiers().contains(JavaModifier.ABSTRACT)) {
                    events.add(SimpleConditionEvent.violated(
                            item, "%s is abstract; Default* impls must be concrete".formatted(item.getDescription())));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> implementAnApiInterfaceFrom(final String apiPackagePattern) {
        final var packagePrefix = apiPackagePattern.replace("..", "");
        return new ArchCondition<>("implement an *Api interface from " + apiPackagePattern) {
            @Override
            public void check(final JavaClass item, final ConditionEvents events) {
                final var implementsApi = item.getAllRawInterfaces().stream()
                        .anyMatch(iface -> iface.getSimpleName().endsWith("Api")
                                && iface.getPackageName().startsWith(packagePrefix));
                if (!implementsApi) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            "%s does not implement any *Api interface from %s"
                                    .formatted(item.getDescription(), apiPackagePattern)));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> implementADomainGateway() {
        return new ArchCondition<>("implement a *Gateway interface from " + DOMAIN) {
            @Override
            public void check(final JavaClass item, final ConditionEvents events) {
                final var implementsGateway = item.getAllRawInterfaces().stream()
                        .anyMatch(iface -> iface.getSimpleName().endsWith("Gateway")
                                && iface.getPackageName().startsWith(BASE + ".domain"));
                if (!implementsGateway) {
                    events.add(SimpleConditionEvent.violated(
                            item, "%s does not implement a domain *Gateway port".formatted(item.getDescription())));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> extendOneOf(final Class<?>... bases) {
        return new ArchCondition<>("extend one of " + Arrays.toString(bases)) {
            @Override
            public void check(final JavaClass item, final ConditionEvents events) {
                final var matched = Arrays.stream(bases)
                        .anyMatch(base ->
                                item.isAssignableTo(base) && !item.getName().equals(base.getName()));
                if (!matched) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            "%s does not extend any of %s".formatted(item.getDescription(), Arrays.toString(bases))));
                }
            }
        };
    }
}
