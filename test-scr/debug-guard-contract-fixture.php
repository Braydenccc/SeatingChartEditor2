<?php
require_once "api/debug-guard-policy.php";

function debugFixtureAssert($condition, $message) {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$validToken = str_repeat('a', DEBUG_GUARD_MIN_TOKEN_BYTES);
debugFixtureAssert(
    !debugGuardCredentialsAuthorized('production', true, $validToken, $validToken),
    'production remains closed even with the enable switch and a matching token'
);
debugFixtureAssert(
    !debugGuardCredentialsAuthorized('development', false, $validToken, $validToken),
    'non-production requires the explicit enable switch'
);
debugFixtureAssert(
    !debugGuardCredentialsAuthorized('development', true, 'short-token', 'short-token'),
    'short debug tokens are rejected'
);
debugFixtureAssert(
    !debugGuardCredentialsAuthorized('test', true, $validToken, str_repeat('b', DEBUG_GUARD_MIN_TOKEN_BYTES)),
    'mismatched debug tokens are rejected'
);
debugFixtureAssert(
    debugGuardCredentialsAuthorized('development', true, $validToken, $validToken),
    'development allows an explicitly enabled request with an independent matching token'
);
debugFixtureAssert(
    debugGuardCredentialsAuthorized('test', true, $validToken, $validToken),
    'test allows an explicitly enabled request with an independent matching token'
);

echo "debug guard contract fixture passed\n";
