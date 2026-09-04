package com.fiap.ford.specsync.greeting;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/greeting")
public class GreetingController {

	@GetMapping
	public GreetingResponse greeting(@RequestParam String name) {
		String normalizedName = name.trim();
		if (normalizedName.isEmpty() || normalizedName.length() > 60) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name must contain between 1 and 60 characters");
		}

		String hash = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
		return new GreetingResponse("Hello, %s, from api".formatted(normalizedName), hash);
	}

	public record GreetingResponse(String message, String hash) {
	}
}
