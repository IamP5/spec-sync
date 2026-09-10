package com.fiap.ford.specsync.infrastructure.gateway.ingestion;

import com.fiap.ford.specsync.domain.catalog.Catalog;
import com.fiap.ford.specsync.domain.ingestion.*;
import com.fiap.ford.specsync.infrastructure.configuration.IngestionProperties;
import com.fiap.ford.specsync.infrastructure.configuration.ResearchProperties;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.*;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class IngestionHttpGateway implements IngestionExtractionGateway {
    private final RestClient client;
    private final RestClient researchClient;
    private final IngestionProperties properties;
    private final ResearchProperties research;
    private final GoogleCloudRunClient cloudRun;

    public IngestionHttpGateway(
            IngestionProperties properties, ResearchProperties research, GoogleCloudRunClient cloudRun) {
        this.cloudRun = Objects.requireNonNull(cloudRun);
        this.research = Objects.requireNonNull(research);
        this.properties = Objects.requireNonNull(properties);
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build());
        factory.setReadTimeout(Duration.ofSeconds(260));
        client = RestClient.builder().requestFactory(factory).build();
        var researchFactory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build());
        researchFactory.setReadTimeout(Duration.ofMinutes(20));
        researchClient = RestClient.builder().requestFactory(researchFactory).build();
    }

    private RestClient.RequestBodySpec request(String path) {
        return request(client, path);
    }

    private RestClient.RequestBodySpec request(RestClient http, String path) {
        if (properties.workerKey() == null || properties.workerKey().length() < 32 || properties.workerUrl() == null)
            throw new IllegalStateException("Configure the ingestion worker URL and key");
        return http.post()
                .uri(properties.workerUrl() + path)
                .header("Authorization", "Bearer " + properties.workerKey())
                .headers(headers -> cloudRun.authorize(headers, properties.workerUrl()))
                .contentType(MediaType.APPLICATION_JSON);
    }

    @Override
    public Ingestion.Draft extract(Ingestion.Request input, List<Catalog.Attribute> attributes) {
        try {
            return Objects.requireNonNull(request("/internal/ingestion/extract")
                    .body(Map.of("request", input, "attributes", attributes))
                    .retrieve()
                    .body(Ingestion.Draft.class));
        } catch (RuntimeException e) {
            LoggerFactory.getLogger(getClass()).warn("Ingestion extraction failed", e);
            throw e;
        }
    }

    @Override
    public Ingestion.Draft extract(Ingestion.Work work, List<Catalog.Attribute> attributes) {
        if (work.researchPolicyVersion() == null) return extract(work.request(), attributes);
        if (!research.enabled()) throw new IllegalStateException("Configure the research service key");
        return Objects.requireNonNull(request(researchClient, "/internal/research/extract")
                .headers(headers -> headers.setBearerAuth(research.serviceKey()))
                .body(Map.of(
                        "workId",
                        work.id(),
                        "attemptId",
                        work.leaseToken(),
                        "policyVersion",
                        work.researchPolicyVersion(),
                        "ontologyRevision",
                        work.ontology().ontologyRevision(),
                        "normalizationRevision",
                        work.ontology().normalizationRevision(),
                        "terminology",
                        work.ontology().terminology(),
                        "attributeValues",
                        work.ontology().attributeValues(),
                        "request",
                        work.request(),
                        "attributes",
                        attributes))
                .retrieve()
                .body(Ingestion.Draft.class));
    }

    @Override
    public void project(Ingestion.Projection input) {
        try {
            request("/internal/ingestion/project")
                    .body("{\"revision\":" + input.revision() + ",\"snapshot\":" + input.snapshot() + "}")
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException e) {
            LoggerFactory.getLogger(getClass()).warn("Ingestion projection failed", e);
            throw e;
        }
    }
}
