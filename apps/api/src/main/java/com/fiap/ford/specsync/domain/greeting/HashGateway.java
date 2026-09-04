package com.fiap.ford.specsync.domain.greeting;

/**
 * Outbound port that produces the opaque request hash of a {@link Greeting}. Random generation is
 * an infrastructure concern, so it stays behind this port and tests can supply a fixed value.
 */
public interface HashGateway {

    String nextHash();
}
