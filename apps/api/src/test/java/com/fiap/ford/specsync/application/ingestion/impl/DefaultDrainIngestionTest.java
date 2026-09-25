package com.fiap.ford.specsync.application.ingestion.impl;

import static org.junit.jupiter.api.Assertions.*;

import com.fiap.ford.specsync.application.ingestion.DrainIngestion;
import com.fiap.ford.specsync.application.ingestion.ProcessIngestion;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import org.junit.jupiter.api.Test;

class DefaultDrainIngestionTest {

    @Test
    void runsCyclesUntilOneFindsNoWork() {
        var process = new ScriptedProcess(List.of(true, true), List.of(true));
        var output = new DefaultDrainIngestion(process).execute(new DrainIngestion.Input(Duration.ofMinutes(3)));
        assertEquals(2, output.cycles());
        assertEquals(List.of(false, true, false, true, false, true), process.calls);
    }

    @Test
    void reportsNoCyclesForAnEmptyQueue() {
        var process = new ScriptedProcess(List.of(), List.of());
        assertEquals(
                0,
                new DefaultDrainIngestion(process)
                        .execute(new DrainIngestion.Input(Duration.ofMinutes(3)))
                        .cycles());
        assertEquals(List.of(false, true), process.calls);
    }

    @Test
    void startsNoNewCycleOnceTheBudgetIsSpent() {
        var process = new ScriptedProcess(List.of(true, true, true), List.of());
        var output = new DefaultDrainIngestion(process).execute(new DrainIngestion.Input(Duration.ZERO));
        assertEquals(1, output.cycles());
        assertEquals(List.of(false, true), process.calls);
    }

    /** Answers from a script per queue, then reports an empty queue; records every call. */
    private static final class ScriptedProcess extends ProcessIngestion {
        private final Deque<Boolean> extractions;
        private final Deque<Boolean> projections;
        private final List<Boolean> calls = new ArrayList<>();

        private ScriptedProcess(List<Boolean> extractions, List<Boolean> projections) {
            this.extractions = new ArrayDeque<>(extractions);
            this.projections = new ArrayDeque<>(projections);
        }

        @Override
        public Boolean execute(Boolean projection) {
            calls.add(projection);
            var script = projection ? projections : extractions;
            return !script.isEmpty() && script.poll();
        }
    }
}
