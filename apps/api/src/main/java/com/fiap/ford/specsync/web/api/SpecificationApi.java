package com.fiap.ford.specsync.web.api;

import com.fiap.ford.specsync.web.dto.response.SpecificationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Vehicle catalog")
@ApiResponses({
    @ApiResponse(responseCode = "200", description = "Specifications with evidence"),
    @ApiResponse(responseCode = "400", description = "Missing or malformed configurationId"),
    @ApiResponse(responseCode = "422", description = "Unknown configuration or attribute code")
})
@RequestMapping(value = "/api/vehicle-specifications", produces = "application/json")
public interface SpecificationApi {
    @GetMapping
    @Operation(summary = "Read specifications and evidence for one configuration")
    SpecificationResponse specifications(
            @RequestParam(name = "configurationId") UUID configurationId,
            @RequestParam(name = "attributes", required = false) List<String> attributes);
}
