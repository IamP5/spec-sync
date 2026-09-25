package com.fiap.ford.specsync.application.ingestion;

import com.fiap.ford.specsync.application.UseCase;

/**
 * Claims and runs at most one queued unit of work: a source extraction, or a graph projection when
 * the input is {@code true}. Returns whether any work was claimed.
 */
public abstract class ProcessIngestion extends UseCase<Boolean, Boolean> {}
