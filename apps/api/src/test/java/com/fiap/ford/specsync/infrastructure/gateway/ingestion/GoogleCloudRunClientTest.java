package com.fiap.ford.specsync.infrastructure.gateway.ingestion;

import static org.junit.jupiter.api.Assertions.*;

import com.fiap.ford.specsync.infrastructure.configuration.CloudRunProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

class GoogleCloudRunClientTest {
    @Test
    void localDevelopmentPreservesWorkerCredentialsWithoutAccessingAdc() {
        var client = new GoogleCloudRunClient(new CloudRunProperties(false));
        var headers = new HttpHeaders();
        headers.setBearerAuth("worker-key");
        client.authorize(headers, "http://localhost:4111");
        assertEquals("Bearer worker-key", headers.getFirst("Authorization"));
        assertNull(headers.getFirst("X-Serverless-Authorization"));
    }

    @Test
    void rejectsInsecureWorkerOriginsBeforeObtainingCredentials() {
        var client = new GoogleCloudRunClient(new CloudRunProperties(true));
        for (var origin : new String[] {"http://worker.run.app", "https://user:secret@worker.run.app"}) {
            assertThrows(IllegalArgumentException.class, () -> client.authorize(new HttpHeaders(), origin));
        }
    }
}
