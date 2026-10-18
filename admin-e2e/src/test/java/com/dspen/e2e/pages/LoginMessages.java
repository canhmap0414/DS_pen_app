package com.dspen.e2e.pages;

/** Expected login texts. They follow the test sheet (the spec), not the current UI strings. */
public final class LoginMessages {
    public static final String TITLE = "Đăng nhập quản trị";
    public static final String EMAIL_LABEL = "Email";
    public static final String EMAIL_PLACEHOLDER = "Hãy nhập email";
    public static final String PASSWORD_LABEL = "Mật khẩu";
    public static final String SUBMIT = "Đăng nhập";

    public static final String EMAIL_REQUIRED = "Hãy nhập email";
    public static final String EMAIL_FORMAT = "Hãy nhập đúng format của email";
    public static final String PASSWORD_REQUIRED = "Hãy nhập password";
    public static final String PASSWORD_LENGTH = "Hãy nhập mật khẩu có 8~70 ký tự";
    public static final String PASSWORD_FORMAT = "Hãy nhập mật khẩu bao gồm chữ hoa, chữ thường và số";
    public static final String INVALID_CREDENTIALS = "Email hoặc password bị sai";

    // The sheet does not define these; they are the current UI strings.
    public static final String LOCKED = "Tài khoản đã bị khoá";
    public static final String NOT_ADMIN = "Tài khoản này không có quyền quản trị";
    public static final String NETWORK = "Không kết nối được máy chủ";
    public static final String SERVER_ERROR = "Đã có lỗi xảy ra, vui lòng thử lại";

    private LoginMessages() {}
}
