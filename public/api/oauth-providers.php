<?php
require_once "api/oauth-common.php";
header("Content-Type: application/json; charset=utf-8");

if (!class_exists("Database")) {
    respond(["success" => false, "message" => "Environment error: Database not supported."], 503);
}

try {
    $providers = [];
    foreach (oauthGetProvidersRaw() as $provider) {
        if (!is_array($provider) || !($provider["enabled"] ?? false)) {
            continue;
        }
        $providers[] = oauthSafeProvider($provider, false);
    }

    respond([
        "success" => true,
        "data" => $providers
    ]);
} catch (Exception $e) {
    error_log("OAuth providers error: " . $e->getMessage());
    respond(["success" => false, "message" => "Internal Server Error"], 500);
}
?>
