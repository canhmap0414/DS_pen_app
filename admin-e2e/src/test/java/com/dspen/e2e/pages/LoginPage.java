package com.dspen.e2e.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import io.qameta.allure.Allure;
import io.qameta.allure.Step;

/** Page object for /login, using the data-testid attributes in web-admin LoginPage.tsx. */
public class LoginPage {
    private final Page page;

    public final Locator email;
    public final Locator password;
    public final Locator submit;
    public final Locator error;

    public LoginPage(Page page) {
        this.page = page;
        this.email = page.getByTestId("login-email");
        this.password = page.getByTestId("login-password");
        this.submit = page.getByTestId("login-submit");
        this.error = page.getByTestId("login-error");
    }

    @Step("Open login page")
    public LoginPage open() {
        page.navigate("/login");
        return this;
    }

    // Not an @Step: Allure would store the password as a step parameter in the result JSON.
    public void login(String email, String password) {
        Allure.step("Log in as " + email, () -> {
            this.email.fill(email);
            this.password.fill(password);
            submit.click();
        });
    }
}
