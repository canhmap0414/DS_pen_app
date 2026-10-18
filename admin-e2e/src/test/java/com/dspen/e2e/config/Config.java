package com.dspen.e2e.config;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Properties;

/** Reads settings from -Dkey=..., then environment variables, then e2e.properties. */
public final class Config {
    private static final Properties FILE = load(Paths.get("e2e.properties"));

    private Config() {}

    public static String baseUrl() {
        return get("E2E_BASE_URL", "http://localhost:5173");
    }

    public static String adminEmail() {
        return required("E2E_ADMIN_EMAIL");
    }

    public static String adminPassword() {
        return required("E2E_ADMIN_PASSWORD");
    }

    /** A locked admin account (status = locked); tests that need it are skipped when unset. */
    public static String lockedEmail() {
        return get("E2E_LOCKED_EMAIL", "");
    }

    public static String lockedPassword() {
        return get("E2E_LOCKED_PASSWORD", "");
    }

    public static boolean headless() {
        return Boolean.parseBoolean(get("HEADLESS", "true"));
    }

    private static String required(String key) {
        String v = get(key, null);
        if (v == null || v.isEmpty()) {
            throw new IllegalStateException("Missing " + key + " (set it in e2e.properties)");
        }
        return v;
    }

    private static String get(String key, String fallback) {
        String v = System.getProperty(key);
        if (v == null) v = System.getenv(key);
        if (v == null) v = FILE.getProperty(key);
        return v != null ? v : fallback;
    }

    private static Properties load(Path path) {
        Properties p = new Properties();
        if (Files.exists(path)) {
            try (InputStream in = Files.newInputStream(path)) {
                p.load(in);
            } catch (IOException e) {
                throw new IllegalStateException("Cannot read " + path, e);
            }
        }
        return p;
    }
}
