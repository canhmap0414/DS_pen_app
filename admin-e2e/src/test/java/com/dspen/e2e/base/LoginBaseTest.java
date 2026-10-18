package com.dspen.e2e.base;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.dspen.e2e.config.Config;
import com.dspen.e2e.pages.AdminLayout;
import com.dspen.e2e.pages.LoginPage;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.provider.Arguments;

/**
 * Shared setup for the login screen tests: every test starts logged out on /login.
 * Tests are named after their row in the test sheet (gid=373845542), e.g. "TC07 - ...".
 */
public abstract class LoginBaseTest extends BaseTest {
    protected static final Pattern LOGIN_URL = Pattern.compile(".*/login$");
    protected static final Pattern DASHBOARD_URL = Pattern.compile("^https?://[^/]+/$");
    protected static final String LOGIN_API = "**/api/v1/auth/login";

    // Passes the sheet's password rules (8~70 chars, upper + lower + digit).
    protected static final String VALID_PASSWORD = "Kim12345";
    protected static final String WRONG_PASSWORD = "Wrong12345";

    protected LoginPage login;
    protected AdminLayout layout;

    @Override
    protected boolean useAdminSession() {
        return false;
    }

    @BeforeEach
    void openLoginPage() {
        login = new LoginPage(page).open();
        layout = new AdminLayout(page);
    }

    protected void loginAsAdmin() {
        login.login(Config.adminEmail(), Config.adminPassword());
        assertThat(layout.username).isVisible();
    }

    /** One row of a parameterized test: sheet id, email, password, expected text. */
    protected static Arguments tc(String id, String email, String password, String expected) {
        return Arguments.of(id, email, password, expected);
    }
}
