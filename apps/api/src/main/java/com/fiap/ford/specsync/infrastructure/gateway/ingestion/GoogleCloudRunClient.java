package com.fiap.ford.specsync.infrastructure.gateway.ingestion;

import com.fiap.ford.specsync.infrastructure.configuration.CloudRunProperties;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.IdTokenCredentials;
import com.google.auth.oauth2.IdTokenProvider;
import java.io.IOException;
import java.net.URI;
import java.util.Objects;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

/** Lazily obtains and refreshes ADC identity tokens for the configured worker. */
@Component
public class GoogleCloudRunClient {
    private final CloudRunProperties properties;
    private IdTokenCredentials credentials;
    private String audience;

    public GoogleCloudRunClient(CloudRunProperties properties) {
        this.properties = Objects.requireNonNull(properties);
    }

    public synchronized void authorize(HttpHeaders headers, String workerUrl) {
        if (!properties.enabled()) return;
        var uri = URI.create(workerUrl);
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
            throw new IllegalArgumentException("Cloud Run worker URL must use HTTPS without credentials");
        var target = uri.getScheme() + "://" + uri.getAuthority();
        try {
            if (credentials == null || !target.equals(audience)) {
                if (!(GoogleCredentials.getApplicationDefault() instanceof IdTokenProvider provider))
                    throw new IllegalStateException("ADC credentials cannot issue Cloud Run identity tokens");
                credentials = IdTokenCredentials.newBuilder()
                        .setIdTokenProvider(provider)
                        .setTargetAudience(target)
                        .build();
                audience = target;
            }
            credentials.refreshIfExpired();
            headers.set(
                    "X-Serverless-Authorization",
                    "Bearer " + credentials.getAccessToken().getTokenValue());
        } catch (IOException error) {
            throw new IllegalStateException("Unable to authenticate to the ingestion worker", error);
        }
    }
}
