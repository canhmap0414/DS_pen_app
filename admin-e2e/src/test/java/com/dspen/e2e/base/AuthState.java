package com.dspen.e2e.base;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.dspen.e2e.config.Config;
import com.dspen.e2e.pages.LoginPage;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import io.qameta.allure.Allure;
import java.io.ByteArrayInputStream;
import java.nio.file.Path;
import java.nio.file.Paths;

/** Logs in as admin once per test run and saves the session for reuse. */
final class AuthState {
    static final Path ADMIN_STATE = Paths.get("target", ".auth", "admin.json");

    private static boolean ready;

    private AuthState() {}

    static synchronized Path admin(Browser browser) {
        if (!ready) {
            BrowserContext context =
                    browser.newContext(new Browser.NewContextOptions().setBaseURL(Config.baseUrl()));
            try {
                Page page = context.newPage();
                new LoginPage(page).open().login(Config.adminEmail(), Config.adminPassword());
                try {
                    assertThat(page.getByTestId("header-username")).isVisible();
                } catch (AssertionError e) {
                    Allure.addAttachment("Admin login screenshot", "image/png",
                            new ByteArrayInputStream(page.screenshot()), ".png");
                    Allure.addAttachment("Admin login URL", page.url());
                    throw new IllegalStateException("Admin login failed for " + Config.adminEmail()
                            + ": check E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in e2e.properties", e);
                }
                context.storageState(new BrowserContext.StorageStateOptions().setPath(ADMIN_STATE));
            } finally {
                context.close();
            }
            ready = true;
        }
        return ADMIN_STATE;
    }
}
