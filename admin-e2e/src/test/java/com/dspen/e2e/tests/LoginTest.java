package com.dspen.e2e.tests;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.dspen.e2e.base.BaseTest;
import com.dspen.e2e.config.Config;
import com.dspen.e2e.pages.LoginPage;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

@Epic("Web admin")
@Feature("Login")
class LoginTest extends BaseTest {
    private static final Pattern LOGIN_URL = Pattern.compile(".*/login$");

    // These tests exercise the login form itself, so start logged out.
    @Override
    protected boolean useAdminSession() {
        return false;
    }

    @Test
    void redirects_to_login_when_not_authenticated() {
        page.navigate("/");
        assertThat(page).hasURL(LOGIN_URL);
    }

    @Test
    void shows_error_for_wrong_password() {
        LoginPage login = new LoginPage(page).open();
        login.login(Config.adminEmail(), "wrong-password");

        assertThat(login.error).isVisible();
        assertThat(page).hasURL(LOGIN_URL);
    }

    @Test
    void logs_in_and_out() {
        new LoginPage(page).open().login(Config.adminEmail(), Config.adminPassword());
        assertThat(page.getByTestId("header-username")).isVisible();

        page.getByTestId("logout").click();
        assertThat(page).hasURL(LOGIN_URL);
    }
}
