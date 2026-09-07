package com.fiap.ford.specsync.application.credits;

import com.fiap.ford.specsync.application.UseCase;
import com.fiap.ford.specsync.domain.credits.Credits;
import java.util.List;

/**
 * Reads a user's wallet, creating it and its signup grant on first contact. Returns the active
 * tariffs alongside it so the caller can render what each model costs and which ones still fit.
 */
public abstract class GetWallet extends UseCase<GetWallet.Input, GetWallet.Output> {

    public record Input(String uid) {}

    public interface Output {

        Credits.Wallet wallet();

        List<Credits.ModelTariff> tariffs();
    }
}
