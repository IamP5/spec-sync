/**
 * Infrastructure layer: outbound adapters (persistence, external services, messaging) that
 * implement the domain gateways, plus the Spring configuration. It may import {@code domain} and
 * {@code application}; it must never import {@code web}. See
 * {@code apps/api/docs/architecture-boundaries.md}.
 */
package com.fiap.ford.specsync.infrastructure;
