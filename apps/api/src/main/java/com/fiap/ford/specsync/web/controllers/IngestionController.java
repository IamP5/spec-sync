package com.fiap.ford.specsync.web.controllers;

import com.fiap.ford.specsync.application.ingestion.*;
import com.fiap.ford.specsync.web.api.IngestionApi;
import com.fiap.ford.specsync.web.dto.request.*;
import com.fiap.ford.specsync.web.dto.response.IngestionResponse;
import java.security.Principal;
import java.util.*;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class IngestionController implements IngestionApi {
    private final CreateIngestion create;
    private final GetIngestion get;
    private final PublishIngestion publish;
    private final RejectIngestion reject;
    private final GetIngestionSource source;

    public IngestionController(
            CreateIngestion create,
            GetIngestion get,
            PublishIngestion publish,
            RejectIngestion reject,
            GetIngestionSource source) {
        this.create = Objects.requireNonNull(create);
        this.get = Objects.requireNonNull(get);
        this.publish = Objects.requireNonNull(publish);
        this.reject = Objects.requireNonNull(reject);
        this.source = Objects.requireNonNull(source);
    }

    @Override
    public IngestionResponse create(CreateIngestionRequest request, Principal principal) {
        return create.execute(
                new CreateIngestion.Input(request.id(), principal.getName(), request.request()),
                o -> new IngestionResponse(o.result()));
    }

    @Override
    public IngestionResponse get(UUID id, Principal principal) {
        return get.execute(new GetIngestion.Input(id, principal.getName()), o -> new IngestionResponse(o.result()));
    }

    @Override
    public org.springframework.http.ResponseEntity<byte[]> source(UUID id, Principal principal) {
        return source.execute(
                new GetIngestionSource.Input(id, principal.getName()),
                output -> org.springframework.http.ResponseEntity.ok()
                        .contentType(org.springframework.http.MediaType.APPLICATION_OCTET_STREAM)
                        .header(
                                "Content-Disposition",
                                "attachment; filename=\"" + id
                                        + (output.result().mimeType().equals("application/pdf") ? ".pdf" : ".html")
                                        + "\"")
                        .header("Cache-Control", "no-store")
                        .body(output.result().bytes()));
    }

    @Override
    public IngestionResponse publish(UUID id, PublishIngestionRequest request, Principal principal) {
        return publish.execute(
                new PublishIngestion.Input(id, principal.getName(), request.review()),
                o -> new IngestionResponse(o.result()));
    }

    @Override
    public IngestionResponse reject(UUID id, Principal principal) {
        return reject.execute(
                new RejectIngestion.Input(id, principal.getName()), o -> new IngestionResponse(o.result()));
    }
}
