package com.dspen.e2e.tests;

import static com.dspen.e2e.pages.LoginMessages.*;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.dspen.e2e.base.LoginBaseTest;
import com.dspen.e2e.config.Config;
import com.microsoft.playwright.Locator;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.qameta.allure.Story;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/** Login sheet cases about submitting: success, wrong credentials, server errors, keyboard. */
@Epic("Web admin")
@Feature("Login")
@Story("Submit")
@TestMethodOrder(MethodOrderer.MethodName.class)
class LoginSubmitTest extends LoginBaseTest {
    private static final String NON_ADMIN_EMAIL = "e2e-non-admin@example.com";

    static Stream<Arguments> successfulLogins() {
        String email = Config.adminEmail();
        String password = Config.adminPassword();
        return Stream.of(
                tc("TC16", email, password, null),
                tc("TC24 khoảng trắng đầu/cuối", "  " + email + "  ", password, null),
                tc("TC25 chữ hoa", email.toUpperCase(), password, null));
    }

    @ParameterizedTest(name = "{0} - Email \"{1}\" đăng nhập thành công")
    @MethodSource("successfulLogins")
    @DisplayName("Đăng nhập thành công")
    void tc16_successfulLogins(String id, String email, String password, String unused) {
        login.login(email, password);
        assertThat(layout.username).isVisible();
    }

    static Stream<Arguments> invalidCredentials() {
        String email = Config.adminEmail();
        String password = Config.adminPassword();
        return Stream.of(
                tc("TC17 email không tồn tại", "not-exist-" + System.nanoTime() + "@gmail.com", password, null),
                tc("TC18 sai password", email, WRONG_PASSWORD, null),
                tc("TC28 password khác hoa/thường", email, swapCase(password), null),
                tc("TC29 password thừa khoảng trắng cuối", email, password + " ", null),
                tc("TC43 SQL injection", email, "Aa1' OR '1'='1", null));
    }

    @ParameterizedTest(name = "{0} - báo lỗi \"Email hoặc password bị sai\"")
    @MethodSource("invalidCredentials")
    @DisplayName("Sai email hoặc password")
    void tc17_invalidCredentials(String id, String email, String password, String unused) {
        login.login(email, password);
        assertThat(login.error).containsText(INVALID_CREDENTIALS);
        assertThat(page).hasURL(LOGIN_URL);
    }

    private static String swapCase(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            sb.append(Character.isUpperCase(c) ? Character.toLowerCase(c) : Character.toUpperCase(c));
        }
        return sb.toString();
    }

    @Test
    @DisplayName("TC31 - Nhấn Enter trong textbox mật khẩu thì submit form")
    void tc31_submitWithEnter() {
        login.fill(Config.adminEmail(), Config.adminPassword());
        login.password.press("Enter");
        assertThat(layout.username).isVisible();
    }

    @Test
    @DisplayName("TC32 - Thứ tự Tab: Email -> Mật khẩu -> icon con mắt -> button Đăng nhập")
    void tc32_tabOrder() {
        login.email.focus();
        for (Locator next : List.of(login.password, login.passwordToggle, login.submit)) {
            page.keyboard().press("Tab");
            assertThat(next).isFocused();
        }
    }

    @Test
    @DisplayName("TC33 - Đang chờ server thì button loading, nhấn nhiều lần chỉ gửi 1 request")
    void tc33_noDoubleSubmit() {
        slowDownNetwork(1500);
        login.login(Config.adminEmail(), Config.adminPassword());
        assertThat(login.submit).hasClass(Pattern.compile("ant-btn-loading"));
        login.submit.click(new Locator.ClickOptions().setForce(true));
        login.submit.click(new Locator.ClickOptions().setForce(true));

        assertThat(layout.username).isVisible();
        assertEquals(1, login.loginRequestCount());
    }

    @Test
    @DisplayName("TC34 - Email không tồn tại và sai password hiển thị cùng một thông báo")
    void tc34_sameMessageForUnknownEmail() {
        login.login("not-exist-" + System.nanoTime() + "@gmail.com", WRONG_PASSWORD);
        assertThat(login.error).containsText(INVALID_CREDENTIALS);
        String unknownEmail = login.error.innerText();

        login.login(Config.adminEmail(), WRONG_PASSWORD);
        assertThat(login.error).hasText(unknownEmail);
    }

    @Test
    @DisplayName("TC35 - Tài khoản bị khoá, password đúng báo \"Tài khoản đã bị khoá\"")
    void tc35_lockedAccount() {
        assumeTrue(!Config.lockedEmail().isEmpty(), "E2E_LOCKED_EMAIL is not set");
        login.login(Config.lockedEmail(), Config.lockedPassword());
        assertThat(login.error).containsText(LOCKED);
        assertThat(page).hasURL(LOGIN_URL);
    }

    @Test
    @DisplayName("TC36 - Tài khoản bị khoá, password sai không lộ trạng thái khoá")
    void tc36_lockedAccountWrongPassword() {
        assumeTrue(!Config.lockedEmail().isEmpty(), "E2E_LOCKED_EMAIL is not set");
        login.login(Config.lockedEmail(), WRONG_PASSWORD);
        assertThat(login.error).containsText(INVALID_CREDENTIALS);
    }

    @Test
    @DisplayName("TC37 - Tài khoản không phải admin không đăng nhập được")
    void tc37_nonAdmin() {
        ensureUser(NON_ADMIN_EMAIL, VALID_PASSWORD, "E2E non-admin");
        login.login(NON_ADMIN_EMAIL, VALID_PASSWORD);
        assertThat(login.error).containsText(NOT_ADMIN);
        assertThat(page).hasURL(LOGIN_URL);
        assertNull(login.storedToken());
    }

    @Test
    @DisplayName("TC38 - Mất kết nối server báo \"Không kết nối được máy chủ\"")
    void tc38_networkDown() {
        failRequests(LOGIN_API);
        login.login(Config.adminEmail(), Config.adminPassword());
        assertThat(login.error).containsText(NETWORK);
    }

    @Test
    @DisplayName("TC39 - Server lỗi 500 báo \"Đã có lỗi xảy ra, vui lòng thử lại\"")
    void tc39_serverError() {
        mockJsonResponse(LOGIN_API, 500, "{\"error\":\"internal_error\"}");
        login.login(Config.adminEmail(), Config.adminPassword());
        assertThat(login.error).containsText(SERVER_ERROR);
    }

    @Test
    @DisplayName("TC40 - Đăng nhập sai rồi sửa đúng thì đăng nhập thành công, lỗi cũ biến mất")
    void tc40_retryAfterError() {
        login.login(Config.adminEmail(), WRONG_PASSWORD);
        assertThat(login.error).isVisible();
        loginAsAdmin();
        assertThat(login.error).hasCount(0);
    }
}
