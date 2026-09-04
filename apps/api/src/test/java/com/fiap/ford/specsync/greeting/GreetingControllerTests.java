package com.fiap.ford.specsync.greeting;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class GreetingControllerTests {

	private final GreetingController controller = new GreetingController();

	@Test
	void createsGreetingWithRandomHash() {
		var first = controller.greeting(" Tuba ");
		var second = controller.greeting("Tuba");

		assertEquals("Hello, Tuba, from api", first.message());
		assertEquals(12, first.hash().length());
		assertNotEquals(first.hash(), second.hash());
	}

	@Test
	void rejectsBlankName() {
		var error = assertThrows(ResponseStatusException.class, () -> controller.greeting("  "));

		assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
	}
}
