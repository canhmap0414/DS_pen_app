package com.dspen.e2e.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import io.qameta.allure.Step;

/** Header of the logged-in admin pages (web-admin AdminLayout.tsx). */
public class AdminLayout {
    public final Locator username;
    public final Locator logoutButton;

    public AdminLayout(Page page) {
        this.username = page.getByTestId("header-username");
        this.logoutButton = page.getByTestId("logout");
    }

    @Step("Log out")
    public void logout() {
        logoutButton.click();
    }
}
