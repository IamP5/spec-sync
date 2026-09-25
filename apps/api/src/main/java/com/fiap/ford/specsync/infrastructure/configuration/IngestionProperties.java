package com.fiap.ford.specsync.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param triggerServiceAccount the only identity allowed to call the drain endpoint (Cloud
 *     Scheduler's service account); blank disables the endpoint
 * @param triggerAudience the audience its Google ID tokens must carry (the API's run.app URL)
 */
@ConfigurationProperties("specsync.ingestion")
public record IngestionProperties(
        boolean enabled,
        String reviewerKey,
        String workerKey,
        String workerUrl,
        String triggerServiceAccount,
        String triggerAudience) {}
