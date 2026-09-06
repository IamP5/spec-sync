package com.fiap.ford.specsync.web.api;

import com.fiap.ford.specsync.web.dto.response.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Vehicle catalog")
@RequestMapping(value = "/api", produces = "application/json")
@ApiResponses({
    @ApiResponse(responseCode = "200", description = "Sourced catalog result"),
    @ApiResponse(responseCode = "400", description = "Missing or malformed query parameter"),
    @ApiResponse(responseCode = "422", description = "Invalid selection, filter, or unknown ID/code")
})
public interface CatalogApi {
    @GetMapping("/vehicle-configurations")
    @Operation(summary = "Search configurations by brand, model or version")
    ConfigurationSearchResponse search(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) String market,
            @RequestParam(required = false) Integer modelYear,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset);

    @GetMapping("/comparison-attributes")
    @Operation(summary = "List supported attribute codes, types, units and scope")
    ComparisonAttributesResponse attributes();

    @GetMapping("/comparisons")
    @Operation(summary = "Compare 2–5 configurations with evidence; omitted attributes selects all")
    ComparisonResponse compare(
            @RequestParam List<UUID> configurationIds, @RequestParam(required = false) List<String> attributes);
}
