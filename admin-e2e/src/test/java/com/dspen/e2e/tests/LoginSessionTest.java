package com.dspen.e2e.tests;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.dspen.e2e.base.LoginBaseTest;
import com.dspen.e2e.config.Config;
import com.dspen.e2e.pages.AdminLayout;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.qameta.allure.Story;
import java.util.List;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/** Login sheet cases about what happens around a login: redirects, session, logout, layout. */
@Epic("Web admin")
@Feature("Login")
@Story("Session")
@TestMethodOrder(MethodOrderer.MethodName.class)
class LoginSessionTest extends LoginBaseTest {
    @Test
    @DisplayName("TC45 - Đăng nhập thành công chuyển sang Dashboard")
    void tc45_redirectAfterLogin() {
        loginAsAdmin();
        assertThat(page).hasURL(DASHBOARD_URL);
    }

    @Test
    @DisplayName("TC46 - Sau khi đăng nhập, nhấn Back không quay lại màn hình login")
    void tc46_backAfterLogin() {
        loginAsAdmin();
        page.goBack();
        assertThat(page).not().hasURL(LOGIN_URL);
    }

    @Test
    @DisplayName("TC47 - Đã đăng nhập, vào URL /login tự chuyển sang Dashboard")
    void tc47_loginPageWhenLoggedIn() {
        loginAsAdmin();
        login.open();
        assertThat(page).hasURL(DASHBOARD_URL);
    }

    @Test
    @DisplayName("TC48 - Chưa đăng nhập, vào URL trang quản trị tự chuyển về login")
    void tc48_protectedPages() {
        for (String path : List.of("/", "/orders", "/users", "/products", "/categories")) {
            page.navigate(path);
            assertThat(page).hasURL(LOGIN_URL);
        }
    }

    @Test
    @DisplayName("TC49 - Reload trang vẫn giữ trạng thái đăng nhập")
    void tc49_reload() {
        loginAsAdmin();
        page.reload();
        assertThat(layout.username).isVisible();
    }

    @Test
    @DisplayName("TC50 - Đóng trình duyệt mở lại vẫn giữ trạng thái đăng nhập")
    void tc50_reopenBrowser() {
        loginAsAdmin();
        BrowserContext reopened = browser.newContext(new Browser.NewContextOptions()
                .setBaseURL(Config.baseUrl()).setStorageState(context.storageState()));
        try {
            Page p = reopened.newPage();
            p.navigate("/");
            assertThat(new AdminLayout(p).username).isVisible();
        } finally {
            reopened.close();
        }
    }

    @Test
    @DisplayName("TC51 - Token hết hạn thì tự đăng xuất và về màn hình login")
    void tc51_expiredToken() {
        loginAsAdmin();
        // A real token lives 24h; a token the server rejects gets the same 401.
        login.replaceStoredToken("expired.token.value");
        page.reload();
        assertThat(page).hasURL(LOGIN_URL);
    }

    @Test
    @DisplayName("TC52 - Đăng xuất rồi nhấn Back không vào lại được trang quản trị")
    void tc52_backAfterLogout() {
        loginAsAdmin();
        page.navigate("/orders");
        assertThat(layout.username).isVisible();

        layout.logout();
        assertThat(page).hasURL(LOGIN_URL);
        assertThat(login.email).hasValue("");

        page.goBack();
        assertThat(page).hasURL(LOGIN_URL);
        assertThat(layout.username).hasCount(0);
    }

    @Test
    @DisplayName("TC53 - Đăng nhập ở tab A, tab B cũng ở trạng thái đăng nhập")
    void tc53_secondTab() {
        loginAsAdmin();
        Page tabB = context.newPage();
        tabB.navigate("/");
        assertThat(new AdminLayout(tabB).username).isVisible();
    }

    @Test
    @DisplayName("TC54 - Màn hình mobile 375px hiển thị đầy đủ, không scroll ngang")
    void tc54_mobile() {
        page.setViewportSize(375, 812);
        login.open();
        assertThat(login.card).isInViewport();
        assertThat(login.submit).isVisible();
        assertFalse(hasHorizontalScroll());
    }

    @Test
    @Disabled("Test tay: Playwright không điều khiển được trình quản lý mật khẩu của trình duyệt")
    @DisplayName("TC55 - Trình duyệt tự điền email và mật khẩu đã lưu")
    void tc55_browserAutofill() {}
}
