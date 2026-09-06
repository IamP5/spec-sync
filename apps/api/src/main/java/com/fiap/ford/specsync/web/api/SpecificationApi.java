package com.fiap.ford.specsync.web.api;

import com.fiap.ford.specsync.web.dto.response.SpecificationResponse;
import io.swagger.v3.oas.annotations.Operation;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RequestMapping(value = "/api/vehicle-specifications", produces = "application/json")
public interface SpecificationApi {
    @GetMapping
    @Operation(summary = "Read specifications and evidence for one configuration")
    SpecificationResponse specifications(
            @RequestParam(name = "configurationId") UUID configurationId,
            @RequestParam(name = "attributes", required = false) List<String> attributes);
}
