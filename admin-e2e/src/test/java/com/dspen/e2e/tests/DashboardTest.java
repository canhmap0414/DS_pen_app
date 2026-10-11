package com.dspen.e2e.tests;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.dspen.e2e.base.BaseTest;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import org.junit.jupiter.api.Test;

@Epic("Web admin")
@Feature("Dashboard")
class DashboardTest extends BaseTest {
    @Test
    void opens_dashboard_as_logged_in_admin() {
        page.navigate("/");
        assertThat(page.getByTestId("header-username")).isVisible();
    }
}
