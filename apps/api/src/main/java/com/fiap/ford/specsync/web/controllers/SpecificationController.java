package com.fiap.ford.specsync.web.controllers;

import com.fiap.ford.specsync.application.catalog.GetVehicleSpecifications;
import com.fiap.ford.specsync.web.api.SpecificationApi;
import com.fiap.ford.specsync.web.dto.response.SpecificationResponse;
import java.util.*;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SpecificationController implements SpecificationApi {
    private final GetVehicleSpecifications useCase;

    public SpecificationController(GetVehicleSpecifications useCase) {
        this.useCase = Objects.requireNonNull(useCase);
    }

    public SpecificationResponse specifications(UUID id, List<String> attributes) {
        return useCase.execute(new GetVehicleSpecifications.Input(id, attributes), SpecificationResponse::from);
    }
}
