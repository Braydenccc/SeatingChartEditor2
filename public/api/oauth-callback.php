<?php
require_once "api/oauth-common.php";

if (!class_exists("Database")) {
    respond(["success" => false, "message" => "Environment error: Database not supported."], 503);
}

function oauthCallbackRedirect($returnTo, $params) {
    $target = oauthSafeReturnTo($returnTo);
    $separator = strpos($target, "?") === false ? "?" : "&";
    header("Location: " . $target . $separator . http_build_query($params), true, 302);
    exit(0);
}

function oauthCallbackFail($message, $returnTo = "/#/user") {
    oauthCallbackRedirect($returnTo, ["oauth_error" => $message]);
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "GET") {
        respond(["success" => false, "message" => "Only GET requests are allowed"], 405);
    }

    if (isset($_GET["error"])) {
        oauthCallbackFail("统一登录已取消或失败");
    }

    $code = isset($_GET["code"]) ? trim((string)$_GET["code"]) : "";
    $stateValue = isset($_GET["state"]) ? trim((string)$_GET["state"]) : "";
    if ($code === "" || $stateValue === "") {
        oauthCallbackFail("统一登录回调参数缺失");
    }

    $state = oauthConsumeState($stateValue);
    if (!$state) {
        oauthCallbackFail("统一登录状态已失效");
    }

    $provider = oauthGetProviderById($state["providerId"] ?? "", true);
    if (!$provider) {
        oauthCallbackFail("统一登录提供商不可用", $state["returnTo"] ?? "");
    }

    $discovery = oauthProviderDiscovery($provider);
    $tokenEndpoint = $discovery["tokenEndpoint"] ?? "";
    $userInfoEndpoint = $discovery["userInfoEndpoint"] ?? "";
    if (!oauthIsHttpsUrl($tokenEndpoint) || !oauthIsHttpsUrl($userInfoEndpoint)) {
        oauthCallbackFail("统一登录端点配置无效", $state["returnTo"] ?? "");
    }

    $tokenResult = oauthTokenRequest($provider, $tokenEndpoint, $code, $state["redirectUri"] ?? oauthCallbackUrl());
    $accessToken = isset($tokenResult["access_token"]) ? trim((string)$tokenResult["access_token"]) : "";
    if ($accessToken === "") {
        oauthCallbackFail("统一登录未返回访问令牌", $state["returnTo"] ?? "");
    }

    $claims = oauthUserInfoRequest($userInfoEndpoint, $accessToken);
    if (!oauthEmailAllowed($claims["email"] ?? "", $provider["allowedDomains"] ?? [])) {
        oauthCallbackFail("当前账号不在允许的邮箱域内", $state["returnTo"] ?? "");
    }
    if (!oauthOrganizationAllowed($claims, $provider["allowedOrganizations"] ?? [])) {
        oauthCallbackFail("当前账号不在允许的组织范围内", $state["returnTo"] ?? "");
    }

    $mode = $state["mode"] ?? "login";
    if ($mode === "bind_oauth") {
        $targetUsername = $state["targetUsername"] ?? "";
        if (!isValidUsername($targetUsername)) {
            oauthCallbackFail("绑定目标账号无效", $state["returnTo"] ?? "");
        }
        $existing = oauthGetIdentity($provider["id"], $provider["issuer"], $claims["sub"] ?? "");
        $existingAccountId = oauthIdentityAccountId($existing);
        $confirmMerge = isset($state["confirmMerge"]) && $state["confirmMerge"] === true;
        if ($existingAccountId !== "" && $existingAccountId !== $targetUsername) {
            $profileDb = new Database("user_profiles");
            if (isUserDisabled($profileDb, $existingAccountId)) {
                oauthCallbackFail("该统一登录所属账号已被禁用", $state["returnTo"] ?? "");
            }
            if (!$confirmMerge) {
                oauthCallbackRedirect($state["returnTo"] ?? "", [
                    "oauth_merge_required" => "1",
                    "provider" => $provider["id"],
                    "oauth_message" => "该统一登录已属于另一个 SCE 账号，确认后会把两个账号的数据合并到当前账号。"
                ]);
            }
        }
        $identity = oauthLinkIdentityToUser($provider, $claims, $targetUsername, $confirmMerge);
    } else {
        $identity = oauthLoginOrProvisionIdentity($provider, $claims);
    }
    oauthCreateSession($identity["username"]);

    $target = oauthSafeReturnTo($state["returnTo"] ?? "");
    $separator = strpos($target, "?") === false ? "?" : "&";
    $resultFlag = $mode === "bind_oauth" ? "oauth_bind=success" : "oauth_login=success";
    header("Location: " . $target . $separator . $resultFlag, true, 302);
    exit(0);
} catch (Exception $e) {
    error_log("OAuth callback error: " . $e->getMessage());
    oauthCallbackFail("统一登录处理失败");
}
?>
