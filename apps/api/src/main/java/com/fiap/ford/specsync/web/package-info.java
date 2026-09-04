/**
 * Web layer: the inbound HTTP adapter. Controllers implement {@code *Api} interfaces and depend on
 * use-case abstractions only; they never touch gateways, {@code Default*} implementations or
 * anything under {@code infrastructure}. See {@code apps/api/docs/architecture-boundaries.md}.
 */
package com.fiap.ford.specsync.web;
