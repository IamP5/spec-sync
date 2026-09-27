package com.fiap.ford.specsync.web.controllers;

import com.fiap.ford.specsync.application.ingestion.*;
import com.fiap.ford.specsync.domain.ingestion.Ingestion;
import com.fiap.ford.specsync.web.api.IngestionApi;
import com.fiap.ford.specsync.web.dto.request.*;
import com.fiap.ford.specsync.web.dto.response.IngestionListResponse;
import com.fiap.ford.specsync.web.dto.response.IngestionResponse;
import java.security.Principal;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
public class IngestionController implements IngestionApi {
    private final CreateIngestion create;
    private final GetIngestion get;
    private final ListIngestions list;
    private final PublishIngestion publish;
    private final RejectIngestion reject;
    private final GetIngestionSource source;

    public IngestionController(
            CreateIngestion create,
            GetIngestion get,
            ListIngestions list,
            PublishIngestion publish,
            RejectIngestion reject,
            GetIngestionSource source) {
        this.create = Objects.requireNonNull(create);
        this.get = Objects.requireNonNull(get);
        this.list = Objects.requireNonNull(list);
        this.publish = Objects.requireNonNull(publish);
        this.reject = Objects.requireNonNull(reject);
        this.source = Objects.requireNonNull(source);
    }

    /** 201 with the run's URI; replaying the same request id returns the same run. */
    @Override
    public ResponseEntity<IngestionResponse> create(CreateIngestionRequest request, Principal principal) {
        final var body = create.execute(
                new CreateIngestion.Input(request.id(), Ingestion.CURATOR_WORKSPACE, request.request()),
                o -> new IngestionResponse(o.result()));
        final var location = ServletUriComponentsBuilder.fromCurrentRequestUri()
                .path("/{id}")
                .buildAndExpand(request.id())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @Override
    public IngestionListResponse list(Principal principal) {
        return list.execute(
                new ListIngestions.Input(Ingestion.CURATOR_WORKSPACE), o -> new IngestionListResponse(o.result()));
    }

    @Override
    public IngestionResponse get(UUID id, Principal principal) {
        return get.execute(
                new GetIngestion.Input(id, Ingestion.CURATOR_WORKSPACE), o -> new IngestionResponse(o.result()));
    }

    @Override
    public ResponseEntity<byte[]> source(UUID id, Principal principal) {
        return source.execute(
                new GetIngestionSource.Input(id, Ingestion.CURATOR_WORKSPACE),
                output -> ResponseEntity.ok()
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
                new PublishIngestion.Input(id, Ingestion.CURATOR_WORKSPACE, request.review(), principal.getName()),
                o -> new IngestionResponse(o.result()));
    }

    @Override
    public IngestionResponse reject(UUID id, Principal principal) {
        return reject.execute(
                new RejectIngestion.Input(id, Ingestion.CURATOR_WORKSPACE), o -> new IngestionResponse(o.result()));
    }
}
