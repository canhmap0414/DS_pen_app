package com.dspen.e2e.base;

import com.dspen.e2e.config.Config;
import com.google.gson.JsonObject;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.CDPSession;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.Route;
import com.microsoft.playwright.Tracing;
import com.microsoft.playwright.options.RequestOptions;
import io.qameta.allure.Allure;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;

/**
 * One browser per test class, a fresh context per test. Tests start logged in as admin;
 * override {@link #useAdminSession()} to start logged out.
 *
 * <p>Every test is traced; when a test fails, a screenshot, the page URL and HTML, the browser
 * console log and the Playwright trace are attached to its Allure result (see {@link FailureEvidence}).
 *
 * <p>The web-admin dev server (npm run dev, :5173), Go backend (:8080) and Postgres must be running.
 */
@ExtendWith(FailureEvidence.class)
public abstract class BaseTest {
    private static final Path TRACE_DIR = Paths.get("target", "traces");

    private static Playwright playwright;
    protected static Browser browser;

    protected BrowserContext context;
    protected Page page;

    private final List<String> consoleLog = new ArrayList<>();
    private boolean tracing;

    @BeforeAll
    static void launchBrowser() {
        playwright = Playwright.create();
        browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(Config.headless()));
    }

    @AfterAll
    static void closeBrowser() {
        playwright.close();
    }

    @BeforeEach
    void createContext() {
        Browser.NewContextOptions options = new Browser.NewContextOptions().setBaseURL(Config.baseUrl());
        if (useAdminSession()) options.setStorageStatePath(AuthState.admin(browser));
        context = browser.newContext(options);
        context.tracing().start(new Tracing.StartOptions().setScreenshots(true).setSnapshots(true));
        tracing = true;

        page = context.newPage();
        page.onConsoleMessage(msg -> consoleLog.add("[" + msg.type() + "] " + msg.text()));
        page.onPageError(err -> consoleLog.add("[pageerror] " + err));
    }

    @AfterEach
    void closeContext() {
        discardTrace();
        if (context != null) context.close();
    }

    protected boolean useAdminSession() {
        return true;
    }

    // ---- Reusable helpers ----

    /** Adds latency to every request (Chromium only), e.g. to catch a loading state. */
    protected void slowDownNetwork(int latencyMs) {
        CDPSession cdp = context.newCDPSession(page);
        cdp.send("Network.enable");
        JsonObject conditions = new JsonObject();
        conditions.addProperty("offline", false);
        conditions.addProperty("latency", latencyMs);
        conditions.addProperty("downloadThroughput", -1);
        conditions.addProperty("uploadThroughput", -1);
        cdp.send("Network.emulateNetworkConditions", conditions);
    }

    /** Makes matching requests fail as if the server were unreachable. */
    protected void failRequests(String urlGlob) {
        page.route(urlGlob, Route::abort);
    }

    protected void mockJsonResponse(String urlGlob, int status, String body) {
        page.route(urlGlob, r -> r.fulfill(new Route.FulfillOptions()
                .setStatus(status).setContentType("application/json").setBody(body)));
    }

    /** Dismisses every alert/confirm the page opens and records its message. */
    protected List<String> collectDialogs() {
        List<String> dialogs = new ArrayList<>();
        page.onDialog(d -> {
            dialogs.add(d.message());
            d.dismiss();
        });
        return dialogs;
    }

    /** Registers a normal (non-admin) user through the public API; an existing email is reused. */
    protected void ensureUser(String email, String password, String username) {
        APIResponse res = context.request().post("/api/v1/auth/register",
                RequestOptions.create().setData(Map.of("email", email, "password", password, "username", username)));
        if (res.status() != 201 && res.status() != 409) {
            throw new IllegalStateException("Register " + email + " failed: HTTP " + res.status() + " " + res.text());
        }
    }

    protected boolean hasHorizontalScroll() {
        return (Boolean) page.evaluate(
                "() => document.documentElement.scrollWidth > document.documentElement.clientWidth");
    }

    void attachEvidence(String testName) {
        try {
            Allure.addAttachment("Screenshot", "image/png",
                    new ByteArrayInputStream(page.screenshot(new Page.ScreenshotOptions().setFullPage(true))), ".png");
        } catch (RuntimeException e) {
            Allure.addAttachment("Screenshot failed", e.toString());
        }
        try {
            Allure.addAttachment("Page URL", page.url());
            Allure.addAttachment("Page HTML", "text/html", page.content(), ".html");
        } catch (RuntimeException e) {
            Allure.addAttachment("Page HTML failed", e.toString());
        }
        if (!consoleLog.isEmpty()) {
            Allure.addAttachment("Browser console", "text/plain", String.join("\n", consoleLog), ".txt");
        }
        if (tracing) {
            Path trace = TRACE_DIR.resolve(testName + ".zip");
            tracing = false;
            try {
                context.tracing().stop(new Tracing.StopOptions().setPath(trace));
                try (InputStream in = Files.newInputStream(trace)) {
                    Allure.addAttachment("Playwright trace (open at trace.playwright.dev)", "application/zip", in, ".zip");
                }
            } catch (Exception e) {
                Allure.addAttachment("Trace failed", e.toString());
            }
        }
    }

    void discardTrace() {
        if (tracing && context != null) {
            tracing = false;
            context.tracing().stop();
        }
    }
}
