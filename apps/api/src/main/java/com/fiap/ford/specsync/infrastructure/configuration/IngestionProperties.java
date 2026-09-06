package com.fiap.ford.specsync.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("specsync.ingestion")
public record IngestionProperties(boolean enabled, String reviewerKey, String workerKey, String workerUrl) {}
