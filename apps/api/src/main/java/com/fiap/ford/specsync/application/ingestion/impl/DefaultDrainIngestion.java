package com.fiap.ford.specsync.application.ingestion.impl;

import com.fiap.ford.specsync.application.ingestion.DrainIngestion;
import com.fiap.ford.specsync.application.ingestion.ProcessIngestion;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class DefaultDrainIngestion extends DrainIngestion {
    private final ProcessIngestion process;

    public DefaultDrainIngestion(ProcessIngestion process) {
        this.process = Objects.requireNonNull(process);
    }

    @Override
    public Output execute(Input input) {
        var deadline = System.nanoTime() + input.budget().toNanos();
        var cycles = 0;
        while (true) {
            // Both steps run every cycle, so projections keep pace with a busy extraction queue.
            var extracted = process.execute(false);
            var projected = process.execute(true);
            if (!extracted && !projected) break;
            cycles++;
            if (System.nanoTime() - deadline >= 0) break;
        }
        var done = cycles;
        return () -> done;
    }
}
