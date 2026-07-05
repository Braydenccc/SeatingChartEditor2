<?php
require_once "api/oauth-common.php";

if (!class_exists("Database")) {
    respond(["success" => false, "message" => "Environment error: Database not supported."], 503);
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "GET") {
        respond(["success" => false, "message" => "Only GET requests are allowed"], 405);
    }

    if (!isHttpsRequest() && !isLocalRequestHost()) {
        respond(["success" => false, "message" => "OAuth 登录必须使用 HTTPS"], 403);
    }

    $providerId = isset($_GET["provider"]) ? oauthNormalizeId($_GET["provider"]) : "";
    $provider = oauthGetProviderById($providerId, true);
    if (!$provider) {
        respond(["success" => false, "message" => "OAuth 提供商不可用"], 404);
    }

    if (trim((string)($provider["clientSecret"] ?? "")) === "") {
        respond(["success" => false, "message" => "OAuth 提供商缺少 Client Secret"], 400);
    }

    $discovery = oauthProviderDiscovery($provider);
    $authorizationEndpoint = $discovery["authorizationEndpoint"] ?? "";
    if (!oauthIsHttpsUrl($authorizationEndpoint)) {
        respond(["success" => false, "message" => "OAuth 授权端点无效"], 400);
    }

    $state = oauthRandomToken(32);
    $nonce = oauthRandomToken(24);
    $returnTo = oauthSafeReturnTo($_GET["returnTo"] ?? "");
    $redirectUri = oauthCallbackUrl();
    $mode = isset($_GET["mode"]) && $_GET["mode"] === "bind" ? "bind_oauth" : "login";
    $confirmMerge = isset($_GET["confirmMerge"]) && $_GET["confirmMerge"] === "true";
    $targetUsername = null;
    if ($mode === "bind_oauth") {
        $sessionDb = new Database("users_sessions");
        $targetUsername = getAuthenticatedUsername($sessionDb);
        if ($targetUsername === null) {
            respond(["success" => false, "message" => "绑定 OAuth 前请先登录"], 401);
        }
    }

    oauthStoreState($state, [
        "providerId" => $provider["id"],
        "mode" => $mode,
        "targetUsername" => $targetUsername,
        "confirmMerge" => $mode === "bind_oauth" && $confirmMerge,
        "nonce" => $nonce,
        "redirectUri" => $redirectUri,
        "returnTo" => $returnTo,
        "createdAt" => time()
    ]);

    $query = [
        "client_id" => $provider["clientId"],
        "response_type" => "code",
        "redirect_uri" => $redirectUri,
        "scope" => implode(" ", $provider["scopes"] ?? oauthNormalizeStringList(OAUTH_DEFAULT_SCOPES)),
        "state" => $state,
        "nonce" => $nonce
    ];

    header("Location: " . $authorizationEndpoint . "?" . http_build_query($query), true, 302);
    exit(0);
} catch (Exception $e) {
    error_log("OAuth start error: " . $e->getMessage());
    respond(["success" => false, "message" => "OAuth 登录初始化失败"], 500);
}
?>
