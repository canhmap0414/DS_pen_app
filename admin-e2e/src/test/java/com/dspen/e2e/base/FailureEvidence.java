package com.dspen.e2e.base;

import org.junit.jupiter.api.extension.AfterTestExecutionCallback;
import org.junit.jupiter.api.extension.ExtensionContext;

/**
 * Runs right after each test body (before @AfterEach closes the browser context), so a failed
 * test can still capture evidence from the live page.
 */
class FailureEvidence implements AfterTestExecutionCallback {
    @Override
    public void afterTestExecution(ExtensionContext ctx) {
        BaseTest test = (BaseTest) ctx.getRequiredTestInstance();
        if (ctx.getExecutionException().isPresent()) {
            test.attachEvidence(ctx.getRequiredTestClass().getSimpleName() + "." + ctx.getRequiredTestMethod().getName());
        } else {
            test.discardTrace();
        }
    }
}
