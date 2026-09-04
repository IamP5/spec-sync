package com.fiap.ford.specsync.application;

/** Inbound port without output (commands whose only result is a side effect). */
public abstract class UnitUseCase<IN> {

    public abstract void execute(IN input);
}
