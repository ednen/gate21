package com.gate21.common;

/** An external provider (Azure Speech, Gemini) failed, timed out, or its circuit breaker is open. */
public class ProviderUnavailableException extends RuntimeException {

    private final String code;

    public ProviderUnavailableException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
