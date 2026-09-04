package com.fiap.ford.specsync.infrastructure.gateway.greeting;

import com.fiap.ford.specsync.domain.greeting.HashGateway;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Reference outbound adapter: implements a domain gateway with a technical detail (UUIDs). */
@Component
public class UuidHashGateway implements HashGateway {

    private static final int HASH_LENGTH = 12;

    @Override
    public String nextHash() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, HASH_LENGTH);
    }
}
