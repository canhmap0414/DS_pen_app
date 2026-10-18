package com.dspen.e2e.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import io.qameta.allure.Allure;
import io.qameta.allure.Step;
import java.util.concurrent.atomic.AtomicInteger;

/** Page object for /login, using the data-testid attributes in web-admin LoginPage.tsx. */
public class LoginPage {
    private static final String AUTH_STORAGE_KEY = "dspen-admin-auth";

    private final Page page;
    private final AtomicInteger loginRequests = new AtomicInteger();

    public final Locator email;
    public final Locator password;
    public final Locator submit;
    public final Locator error;

    // The locators below have no data-testid, so they rely on antd's class names.
    public final Locator card;
    public final Locator title;
    public final Locator emailLabel;
    public final Locator emailIcon;
    public final Locator emailError;
    public final Locator passwordLabel;
    public final Locator passwordIcon;
    public final Locator passwordError;
    public final Locator passwordToggle;

    public LoginPage(Page page) {
        this.page = page;
        this.email = page.getByTestId("login-email");
        this.password = page.getByTestId("login-password");
        this.submit = page.getByTestId("login-submit");
        this.error = page.getByTestId("login-error");

        this.card = page.locator(".login-card");
        this.title = card.locator("h3");

        Locator emailItem = formItem(email);
        this.emailLabel = emailItem.locator("label");
        this.emailIcon = emailItem.locator(".ant-input-prefix .anticon-mail");
        this.emailError = emailItem.locator(".ant-form-item-explain-error");

        Locator passwordItem = formItem(password);
        this.passwordLabel = passwordItem.locator("label");
        this.passwordIcon = passwordItem.locator(".ant-input-prefix .anticon-lock");
        this.passwordError = passwordItem.locator(".ant-form-item-explain-error");
        this.passwordToggle = passwordItem.locator(".ant-input-password-icon");

        page.onRequest(r -> {
            if (r.method().equals("POST") && r.url().endsWith("/api/v1/auth/login")) loginRequests.incrementAndGet();
        });
    }

    private Locator formItem(Locator input) {
        return page.locator(".ant-form-item").filter(new Locator.FilterOptions().setHas(input));
    }

    @Step("Open login page")
    public LoginPage open() {
        page.navigate("/login");
        return this;
    }

    // Not @Steps: Allure would store the password as a step parameter in the result JSON.
    public void fill(String email, String password) {
        Allure.step("Fill in " + email, () -> {
            this.email.fill(email);
            this.password.fill(password);
        });
    }

    public void login(String email, String password) {
        fill(email, password);
        submit.click();
    }

    /** How many login requests this page has sent; 0 means client-side validation stopped the submit. */
    public int loginRequestCount() {
        return loginRequests.get();
    }

    /** The token the app keeps in localStorage, or null when logged out. */
    public String storedToken() {
        return (String) page.evaluate("k => JSON.parse(localStorage.getItem(k) || '{}').state?.token ?? null",
                AUTH_STORAGE_KEY);
    }

    public void replaceStoredToken(String token) {
        page.evaluate("([k, t]) => { const s = JSON.parse(localStorage.getItem(k));"
                + " s.state.token = t; localStorage.setItem(k, JSON.stringify(s)); }",
                new String[] {AUTH_STORAGE_KEY, token});
    }
}
