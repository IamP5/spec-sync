/**
 * Application layer: use cases that orchestrate the domain through its gateways (ports). It may
 * import {@code domain} and, only on the {@code Default*} implementations inside {@code impl}
 * packages, the Spring stereotype and transaction annotations. Never import
 * {@code infrastructure} or {@code web}. See {@code apps/api/docs/architecture-boundaries.md}.
 */
package com.fiap.ford.specsync.application;
