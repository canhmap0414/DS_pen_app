package com.dspen.e2e.tests;

import static com.dspen.e2e.pages.LoginMessages.*;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dspen.e2e.base.LoginBaseTest;
import com.dspen.e2e.config.Config;
import com.dspen.e2e.pages.LoginPage;
import com.microsoft.playwright.Locator;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.qameta.allure.Story;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/** Login sheet cases about the form itself: display, input and client-side validation. */
@Epic("Web admin")
@Feature("Login")
@Story("Form")
@TestMethodOrder(MethodOrderer.MethodName.class)
class LoginFormTest extends LoginBaseTest {
    /** Picks an element of the login page, so static @MethodSource rows can point at locators. */
    interface Target extends Function<LoginPage, Locator> {}

    private static Arguments ui(String id, Target target) {
        return Arguments.of(id, target, null);
    }

    private static Arguments ui(String id, Target target, String expected) {
        return Arguments.of(id, target, expected);
    }

    // ---- Display ----

    static Stream<Arguments> texts() {
        return Stream.of(
                ui("TC01 - Title", p -> p.title, TITLE),
                ui("TC02 - Label của textbox email", p -> p.emailLabel, EMAIL_LABEL),
                ui("TC10 - Label của textbox mật khẩu", p -> p.passwordLabel, PASSWORD_LABEL),
                ui("TC14 - Label của button", p -> p.submit, SUBMIT));
    }

    @ParameterizedTest(name = "{0} là \"{2}\"")
    @MethodSource("texts")
    @DisplayName("Text hiển thị")
    void tc01_texts(String id, Target target, String expected) {
        assertThat(target.apply(login)).hasText(expected);
    }

    static Stream<Arguments> inputs() {
        return Stream.of(ui("TC03 - Textbox email", p -> p.email), ui("TC11 - Textbox mật khẩu", p -> p.password));
    }

    @ParameterizedTest(name = "{0} mặc định chưa nhập")
    @MethodSource("inputs")
    @DisplayName("Giá trị mặc định")
    void tc03_emptyByDefault(String id, Target target, String unused) {
        assertThat(target.apply(login)).hasValue("");
    }

    @Test
    @DisplayName("TC04 - Placeholder của textbox email là \"Hãy nhập email\"")
    void tc04_placeholder() {
        assertThat(login.email).hasAttribute("placeholder", EMAIL_PLACEHOLDER);
    }

    static Stream<Arguments> icons() {
        return Stream.of(
                ui("TC19 - Icon email ở textbox email", p -> p.emailIcon),
                ui("TC20 - Icon khoá ở textbox mật khẩu", p -> p.passwordIcon),
                ui("TC20 - Icon con mắt ở textbox mật khẩu", p -> p.passwordToggle));
    }

    @ParameterizedTest(name = "{0} hiển thị")
    @MethodSource("icons")
    @DisplayName("Icon hiển thị")
    void tc19_icons(String id, Target target, String unused) {
        assertThat(target.apply(login)).isVisible();
    }

    @Test
    @DisplayName("TC21 - Mật khẩu nhập vào hiển thị dạng ẩn")
    void tc21_passwordHidden() {
        login.password.fill(VALID_PASSWORD);
        assertThat(login.password).hasAttribute("type", "password");
    }

    @Test
    @DisplayName("TC22 - Nhấn icon con mắt để hiện / ẩn mật khẩu")
    void tc22_passwordToggle() {
        login.password.fill(VALID_PASSWORD);
        login.passwordToggle.click();
        assertThat(login.password).hasAttribute("type", "text");
        login.passwordToggle.click();
        assertThat(login.password).hasAttribute("type", "password");
    }

    // ---- Input ----

    @Test
    @DisplayName("TC05 - Textbox email cho phép nhập các loại ký tự")
    void tc05_anyCharacters() {
        String value = "aZ09!#$%&'*+-/=?^_`{|}~.@ àáạ";
        login.email.fill(value);
        assertThat(login.email).hasValue(value);
    }

    @Test
    @DisplayName("TC06 - Textbox email chỉ nhận tối đa 225 ký tự")
    void tc06_emailMaxLength() {
        login.email.pressSequentially("a".repeat(230));
        assertEquals(225, login.email.inputValue().length());
    }

    @Test
    @DisplayName("TC30 - Cho phép paste mật khẩu từ clipboard")
    void tc30_pastePassword() {
        context.grantPermissions(List.of("clipboard-read", "clipboard-write"));
        page.evaluate("t => navigator.clipboard.writeText(t)", VALID_PASSWORD);
        login.password.focus();
        page.keyboard().press("ControlOrMeta+V");
        assertThat(login.password).hasValue(VALID_PASSWORD);
    }

    // ---- Validation: an error under the field, and no request sent ----

    static Stream<Arguments> emailErrors() {
        return Stream.of(
                tc("TC07", "abc@abc", VALID_PASSWORD, EMAIL_FORMAT),
                tc("TC08", "abc.com", VALID_PASSWORD, EMAIL_FORMAT),
                tc("TC15.1", "", VALID_PASSWORD, EMAIL_REQUIRED),
                tc("TC23", "   ", VALID_PASSWORD, EMAIL_REQUIRED),
                tc("TC26", "cảnhmap@gmail.com", VALID_PASSWORD, EMAIL_FORMAT),
                tc("TC27", "canh map@gmail.com", VALID_PASSWORD, EMAIL_FORMAT),
                tc("TC42 SQL injection", "' OR 1=1 --", VALID_PASSWORD, EMAIL_FORMAT),
                tc("TC44 XSS", "<script>alert(1)</script>@a.com", VALID_PASSWORD, EMAIL_FORMAT));
    }

    @ParameterizedTest(name = "{0} - Email \"{1}\" báo lỗi \"{3}\"")
    @MethodSource("emailErrors")
    @DisplayName("Lỗi ở textbox email")
    void tc07_emailErrors(String id, String email, String password, String expected) {
        List<String> dialogs = collectDialogs();
        login.login(email, password);
        assertThat(login.emailError).hasText(expected);
        assertEquals(0, login.loginRequestCount());
        assertTrue(dialogs.isEmpty(), "Script ran and opened dialogs: " + dialogs);
    }

    static Stream<Arguments> passwordErrors() {
        String email = Config.adminEmail();
        return Stream.of(
                tc("TC12.1 dưới 8 ký tự", email, "Aa1bcde", PASSWORD_LENGTH),
                tc("TC12.2 trên 70 ký tự", email, "Aa1" + "b".repeat(68), PASSWORD_LENGTH),
                tc("TC13", email, "12345678", PASSWORD_FORMAT),
                tc("TC15.2", email, "", PASSWORD_REQUIRED));
    }

    @ParameterizedTest(name = "{0} - Mật khẩu \"{2}\" báo lỗi \"{3}\"")
    @MethodSource("passwordErrors")
    @DisplayName("Lỗi ở textbox mật khẩu")
    void tc12_passwordErrors(String id, String email, String password, String expected) {
        login.login(email, password);
        assertThat(login.passwordError).hasText(expected);
        assertEquals(0, login.loginRequestCount());
    }

    @Test
    @DisplayName("TC09 - Email đúng format (abc@gmail.com) không báo lỗi")
    void tc09_validEmail() {
        login.login("abc@gmail.com", VALID_PASSWORD);
        // The request only goes out once the form validates, so wait for its answer first.
        assertThat(login.error).isVisible();
        assertThat(login.emailError).hasCount(0);
    }

    @Test
    @DisplayName("TC41 - Lỗi \"Hãy nhập email\" biến mất khi nhập email đúng format")
    void tc41_errorClears() {
        login.login("", VALID_PASSWORD);
        assertThat(login.emailError).hasText(EMAIL_REQUIRED);
        login.email.fill(Config.adminEmail());
        assertThat(login.emailError).hasCount(0);
    }
}
