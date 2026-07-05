<?php
require_once "api/common.php";
require_once "api/file-permissions.php";

const OAUTH_PROVIDER_DB_NAME = "oauth_providers";
const OAUTH_PROVIDER_LIST_KEY = "providers";
const OAUTH_STATE_DB_NAME = "oauth_states";
const OAUTH_IDENTITY_DB_NAME = "oauth_identity_links";
const PASSWORD_LOGIN_LINK_DB_NAME = "password_login_links";
const OAUTH_STATE_EXPIRY_SECONDS = 600;
const OAUTH_SESSION_EXPIRY_DAYS = 30;
const OAUTH_DEFAULT_SCOPES = "openid profile email";

function oauthJsonDecode($raw, $fallback = []) {
    if (!is_string($raw) || trim($raw) === "") {
        return $fallback;
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function oauthBase64UrlEncode($value) {
    return rtrim(strtr(base64_encode($value), "+/", "-_"), "=");
}

function oauthRandomToken($byteLength = 32) {
    return oauthBase64UrlEncode(random_bytes($byteLength));
}

function oauthNormalizeId($id) {
    $normalized = strtolower(preg_replace("/[^a-zA-Z0-9_-]/", "-", trim((string)$id)));
    $normalized = trim(preg_replace("/-+/", "-", $normalized), "-_");
    return substr($normalized, 0, 40);
}

function oauthNormalizeUrl($url) {
    return rtrim(trim((string)$url), "/");
}

function oauthIsHttpsUrl($url) {
    $parts = parse_url($url);
    return is_array($parts) &&
        isset($parts["scheme"], $parts["host"]) &&
        strtolower($parts["scheme"]) === "https";
}

function oauthDiscoveryUrl($issuer) {
    return oauthNormalizeUrl($issuer) . "/.well-known/openid-configuration";
}

function oauthHttpJson($url, $options = []) {
    if (!oauthIsHttpsUrl($url)) {
        throw new Exception("OAuth endpoint must use HTTPS");
    }

    $method = isset($options["method"]) ? strtoupper($options["method"]) : "GET";
    $headers = isset($options["headers"]) && is_array($options["headers"]) ? $options["headers"] : [];
    $body = isset($options["body"]) ? $options["body"] : null;

    if (function_exists("curl_init")) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_USERAGENT, "SCEv2-OAuth/1.0");
        if ($method === "POST") {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        if (!empty($headers)) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        }

        $response = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false || $error) {
            throw new Exception("OAuth endpoint request failed");
        }
    } else {
        $context = stream_context_create([
            "http" => [
                "method" => $method,
                "header" => implode("\r\n", $headers),
                "content" => $body,
                "ignore_errors" => true,
                "timeout" => 15
            ]
        ]);
        $response = @file_get_contents($url, false, $context);
        $status = 0;
        if (isset($http_response_header) && is_array($http_response_header)) {
            foreach ($http_response_header as $headerLine) {
                if (preg_match("/^HTTP\/\S+\s+(\d{3})\b/", $headerLine, $matches)) {
                    $status = (int)$matches[1];
                    break;
                }
            }
        }
        if (!is_string($response)) {
            throw new Exception("OAuth endpoint request failed");
        }
    }

    if ($status < 200 || $status >= 300) {
        throw new Exception("OAuth endpoint returned HTTP " . $status);
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded)) {
        throw new Exception("OAuth endpoint returned invalid JSON");
    }

    return $decoded;
}

function oauthGetProvidersRaw() {
    $db = new Database(OAUTH_PROVIDER_DB_NAME);
    $providers = oauthJsonDecode($db->get(OAUTH_PROVIDER_LIST_KEY), []);
    return is_array($providers) ? $providers : [];
}

function oauthSaveProvidersRaw($providers) {
    $db = new Database(OAUTH_PROVIDER_DB_NAME);
    $db->set(OAUTH_PROVIDER_LIST_KEY, json_encode(array_values($providers), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP));
}

function oauthNormalizeStringList($value) {
    if (is_array($value)) {
        $items = $value;
    } elseif (is_string($value)) {
        $items = preg_split("/[\r\n,]+/", $value);
    } else {
        return [];
    }

    $result = [];
    foreach ($items as $item) {
        $text = trim((string)$item);
        if ($text !== "") {
            $result[] = $text;
        }
    }

    return array_values(array_unique($result));
}

function oauthNormalizeProvider($provider, $existing = null) {
    if (!is_array($provider)) {
        return null;
    }

    $id = oauthNormalizeId($provider["id"] ?? "");
    $name = trim((string)($provider["name"] ?? ""));
    $issuer = oauthNormalizeUrl($provider["issuer"] ?? "");
    $clientId = trim((string)($provider["clientId"] ?? ""));
    $clientSecret = array_key_exists("clientSecret", $provider)
        ? trim((string)$provider["clientSecret"])
        : "";

    if ($id === "" || $name === "" || $issuer === "" || $clientId === "") {
        return null;
    }

    if (!oauthIsHttpsUrl($issuer)) {
        return null;
    }

    $normalized = [
        "id" => $id,
        "name" => $name,
        "type" => "oidc",
        "enabled" => isset($provider["enabled"]) ? !!$provider["enabled"] : true,
        "issuer" => $issuer,
        "clientId" => $clientId,
        "clientSecret" => $clientSecret !== "" ? $clientSecret : ($existing["clientSecret"] ?? ""),
        "scopes" => oauthNormalizeStringList($provider["scopes"] ?? OAUTH_DEFAULT_SCOPES),
        "authorizationEndpoint" => oauthNormalizeUrl($provider["authorizationEndpoint"] ?? ""),
        "tokenEndpoint" => oauthNormalizeUrl($provider["tokenEndpoint"] ?? ""),
        "userInfoEndpoint" => oauthNormalizeUrl($provider["userInfoEndpoint"] ?? ""),
        "jwksUri" => oauthNormalizeUrl($provider["jwksUri"] ?? ""),
        "tokenAuthMethod" => ($provider["tokenAuthMethod"] ?? "client_secret_post") === "client_secret_basic"
            ? "client_secret_basic"
            : "client_secret_post",
        "autoProvision" => isset($provider["autoProvision"]) ? !!$provider["autoProvision"] : true,
        "allowedDomains" => oauthNormalizeStringList($provider["allowedDomains"] ?? []),
        "allowedOrganizations" => oauthNormalizeStringList($provider["allowedOrganizations"] ?? []),
        "updatedAt" => date("c")
    ];

    if (empty($normalized["scopes"])) {
        $normalized["scopes"] = oauthNormalizeStringList(OAUTH_DEFAULT_SCOPES);
    }

    return $normalized;
}

function oauthSafeProvider($provider, $includeAdminFields = false) {
    $safe = [
        "id" => $provider["id"] ?? "",
        "name" => $provider["name"] ?? "",
        "type" => $provider["type"] ?? "oidc",
        "enabled" => !!($provider["enabled"] ?? false),
        "issuer" => $provider["issuer"] ?? "",
        "clientId" => $includeAdminFields ? ($provider["clientId"] ?? "") : "",
        "scopes" => $provider["scopes"] ?? oauthNormalizeStringList(OAUTH_DEFAULT_SCOPES),
        "authorizationEndpoint" => $includeAdminFields ? ($provider["authorizationEndpoint"] ?? "") : "",
        "tokenEndpoint" => $includeAdminFields ? ($provider["tokenEndpoint"] ?? "") : "",
        "userInfoEndpoint" => $includeAdminFields ? ($provider["userInfoEndpoint"] ?? "") : "",
        "jwksUri" => $includeAdminFields ? ($provider["jwksUri"] ?? "") : "",
        "tokenAuthMethod" => $includeAdminFields ? ($provider["tokenAuthMethod"] ?? "client_secret_post") : "",
        "autoProvision" => !!($provider["autoProvision"] ?? true),
        "allowedDomains" => $includeAdminFields ? ($provider["allowedDomains"] ?? []) : [],
        "allowedOrganizations" => $includeAdminFields ? ($provider["allowedOrganizations"] ?? []) : [],
        "hasClientSecret" => trim((string)($provider["clientSecret"] ?? "")) !== "",
        "callbackUrl" => oauthCallbackUrl()
    ];

    return $safe;
}

function oauthGetProviderById($providerId, $enabledOnly = true) {
    $normalizedId = oauthNormalizeId($providerId);
    foreach (oauthGetProvidersRaw() as $provider) {
        if (!is_array($provider) || ($provider["id"] ?? "") !== $normalizedId) {
            continue;
        }
        if ($enabledOnly && !($provider["enabled"] ?? false)) {
            return null;
        }
        return $provider;
    }
    return null;
}

function oauthCallbackUrl() {
    $scheme = isHttpsRequest() ? "https" : "http";
    $host = isset($_SERVER["HTTP_HOST"]) ? trim((string)$_SERVER["HTTP_HOST"]) : "";
    if ($host === "") {
        return "/api/oauth-callback.php";
    }
    return $scheme . "://" . $host . "/api/oauth-callback.php";
}

function oauthSafeReturnTo($returnTo) {
    $value = trim((string)$returnTo);
    if ($value === "") {
        return "/#/user";
    }
    if (preg_match("/^\/#\/[A-Za-z0-9_?&=.%:\/-]*$/", $value)) {
        return $value;
    }
    if (isHttpsSameHostUrl($value)) {
        return $value;
    }
    return "/#/user";
}

function oauthProviderDiscovery($provider) {
    $hasManualEndpoints =
        !empty($provider["authorizationEndpoint"]) &&
        !empty($provider["tokenEndpoint"]) &&
        !empty($provider["userInfoEndpoint"]);
    $discovery = $hasManualEndpoints ? [] : oauthHttpJson(oauthDiscoveryUrl($provider["issuer"]));
    return [
        "authorizationEndpoint" => $provider["authorizationEndpoint"] ?: ($discovery["authorization_endpoint"] ?? ""),
        "tokenEndpoint" => $provider["tokenEndpoint"] ?: ($discovery["token_endpoint"] ?? ""),
        "userInfoEndpoint" => $provider["userInfoEndpoint"] ?: ($discovery["userinfo_endpoint"] ?? ""),
        "jwksUri" => $provider["jwksUri"] ?: ($discovery["jwks_uri"] ?? "")
    ];
}

function oauthStoreState($state, $payload) {
    $db = new Database(OAUTH_STATE_DB_NAME);
    $payload["expiresAt"] = time() + OAUTH_STATE_EXPIRY_SECONDS;
    $db->set(sanitizeDbKey($state), json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP));
}

function oauthGetIdentity($providerId, $issuer, $sub) {
    $identityDb = new Database(OAUTH_IDENTITY_DB_NAME);
    $identityKey = oauthIdentityKey($providerId, $issuer, $sub);
    $identity = oauthJsonDecode($identityDb->get($identityKey), null);
    return is_array($identity) ? $identity : null;
}

function oauthNormalizeAccountId($accountId) {
    return isValidUsername($accountId) ? $accountId : "";
}

function oauthGenerateAccountId($seed) {
    return "acct_" . substr(hash("sha256", (string)$seed . "|" . oauthRandomToken(12)), 0, 26);
}

function oauthPasswordLinkDb() {
    return new Database(PASSWORD_LOGIN_LINK_DB_NAME);
}

function oauthResolvePasswordAccountId($loginUsername) {
    if (!isValidUsername($loginUsername)) {
        return "";
    }

    $linkDb = oauthPasswordLinkDb();
    $linkedAccountId = oauthNormalizeAccountId($linkDb->get($loginUsername));
    if ($linkedAccountId !== "") {
        return $linkedAccountId;
    }

    $usersDb = new Database("users");
    $value = $usersDb->get($loginUsername);
    if (oauthIsPasswordHashValue($value) || oauthIsExternalUserMarkerValue($value)) {
        return $loginUsername;
    }

    return "";
}

function oauthSetPasswordLoginLink($loginUsername, $accountId) {
    if (!isValidUsername($loginUsername) || !isValidUsername($accountId)) {
        return;
    }

    $linkDb = oauthPasswordLinkDb();
    $linkDb->set($loginUsername, $accountId);
}

function oauthIsPasswordHashValue($value) {
    if (!is_string($value) || $value === "") {
        return false;
    }

    $info = password_get_info($value);
    return isset($info["algo"]) && $info["algo"] !== 0 && $info["algo"] !== null;
}

function oauthIsExternalUserMarkerValue($value) {
    return is_string($value) && strpos($value, "external:") === 0;
}

function oauthIsExternalUser($username) {
    if (!isValidUsername($username)) {
        return false;
    }

    $usersDb = new Database("users");
    $value = $usersDb->get($username);
    return oauthIsExternalUserMarkerValue($value);
}

function oauthGetPasswordLoginHash($loginUsername) {
    if (!isValidUsername($loginUsername)) {
        return null;
    }

    $usersDb = new Database("users");
    $value = $usersDb->get($loginUsername);
    return oauthIsPasswordHashValue($value) ? $value : null;
}

function oauthResolvePasswordLogin($loginUsername) {
    $hash = oauthGetPasswordLoginHash($loginUsername);
    if ($hash === null) {
        return null;
    }

    $accountId = oauthResolvePasswordAccountId($loginUsername);
    if ($accountId === "") {
        $accountId = $loginUsername;
    }

    return [
        "loginUsername" => $loginUsername,
        "accountId" => $accountId,
        "hash" => $hash
    ];
}

function oauthListPasswordUsernames($accountId) {
    if (!isValidUsername($accountId)) {
        return [];
    }

    $usersDb = new Database("users");
    $linkDb = oauthPasswordLinkDb();
    $usernames = [];

    $keys = $linkDb->list_keys();
    if (is_array($keys)) {
        foreach ($keys as $key) {
            if (!isValidUsername($key)) {
                continue;
            }
            if ($linkDb->get($key) === $accountId && oauthGetPasswordLoginHash($key) !== null) {
                $usernames[] = $key;
            }
        }
    }

    $legacyValue = $usersDb->get($accountId);
    if (oauthIsPasswordHashValue($legacyValue)) {
        $usernames[] = $accountId;
    }

    return array_values(array_unique($usernames));
}

function oauthGetPrimaryPasswordUsername($accountId) {
    $usernames = oauthListPasswordUsernames($accountId);
    sort($usernames);
    return $usernames[0] ?? "";
}

function oauthUserHasPassword($accountId) {
    return count(oauthListPasswordUsernames($accountId)) > 0;
}

function oauthBuildPasswordLoginMethod($loginUsername) {
    return [
        "type" => "password",
        "label" => "账号密码登录",
        "username" => $loginUsername,
        "boundAt" => ""
    ];
}

function oauthDisplayProviderName($identity) {
    $providerId = isset($identity["providerId"]) ? oauthNormalizeId($identity["providerId"]) : "";
    if ($providerId !== "") {
        $provider = oauthGetProviderById($providerId, false);
        if (is_array($provider) && trim((string)($provider["name"] ?? "")) !== "") {
            return trim((string)$provider["name"]);
        }
    }

    $providerName = trim((string)($identity["providerName"] ?? ""));
    return $providerName !== "" ? $providerName : "OAuth";
}

function oauthBuildLoginMethods($accountId) {
    $methods = [];
    foreach (oauthListPasswordUsernames($accountId) as $loginUsername) {
        $methods[] = oauthBuildPasswordLoginMethod($loginUsername);
    }
    foreach (oauthListUserIdentities($accountId) as $identity) {
        $providerName = oauthDisplayProviderName($identity);
        $methods[] = [
            "type" => "oauth",
            "label" => $providerName . " 登录",
            "providerId" => $identity["providerId"] ?? "",
            "providerName" => $providerName,
            "email" => $identity["email"] ?? "",
            "displayName" => $identity["displayName"] ?? "",
            "boundAt" => $identity["linkedAt"] ?? ""
        ];
    }
    return $methods;
}

function oauthLoginMethodCount($accountId) {
    return count(oauthListPasswordUsernames($accountId)) + count(oauthListUserIdentities($accountId));
}

function oauthGetUserAuthSources($accountId) {
    if (!isValidUsername($accountId)) {
        return [];
    }

    $sources = [];
    if (oauthUserHasPassword($accountId)) {
        $sources[] = "password";
        $sources[] = "sce";
    }
    foreach (oauthListUserIdentities($accountId) as $identity) {
        if (!empty($identity["providerId"])) {
            $sources[] = $identity["providerId"];
        }
    }
    return array_values(array_unique(array_filter($sources)));
}

function oauthBuildAccountUserData($accountId) {
    $profileDb = new Database("user_profiles");
    $profile = getUserProfile($profileDb, $accountId);
    $passwordUsername = oauthGetPrimaryPasswordUsername($accountId);
    $displayName = $profile["displayName"] ?? $profile["name"] ?? "";
    if ($displayName === "") {
        $displayName = $passwordUsername !== "" ? $passwordUsername : $accountId;
    }
    return [
        "accountId" => $accountId,
        "username" => $accountId,
        "displayName" => $displayName,
        "passwordUsername" => $passwordUsername,
        "hasPassword" => $passwordUsername !== "",
        "authSources" => oauthGetUserAuthSources($accountId),
        "loginMethods" => oauthBuildLoginMethods($accountId),
        "oauthIdentities" => array_map("oauthSafeIdentity", oauthListUserIdentities($accountId))
    ];
}

function oauthEnsureAccountProfile($accountId, $claims = []) {
    $profileDb = new Database("user_profiles");
    $profile = getUserProfile($profileDb, $accountId);
    if (!isset($profile["createdAt"])) {
        $profile["createdAt"] = date("c");
    }
    $profile["status"] = $profile["status"] ?? "active";
    $profile["updatedAt"] = date("c");
    $displayName = $claims["name"] ?? $claims["displayName"] ?? $profile["displayName"] ?? "";
    if ($displayName === "") {
        $passwordUsername = oauthGetPrimaryPasswordUsername($accountId);
        $displayName = $passwordUsername !== "" ? $passwordUsername : $accountId;
    }
    $profile["displayName"] = $displayName;
    if (isset($claims["email"])) {
        $profile["email"] = $claims["email"];
    }
    $profile["authSources"] = oauthGetUserAuthSources($accountId);
    $profileDb->set($accountId, json_encode($profile, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP));
}

function oauthUpdateUserProfileAuthSource($accountId, $providerId, $claims = []) {
    $profileDb = new Database("user_profiles");
    $profile = getUserProfile($profileDb, $accountId);
    $sources = isset($profile["authSources"]) && is_array($profile["authSources"]) ? $profile["authSources"] : [];
    $sources[] = $providerId;
    foreach (oauthGetUserAuthSources($accountId) as $source) {
        $sources[] = $source;
    }
    $profile["authSources"] = array_values(array_unique($sources));
    $profile["displayName"] = $claims["name"] ?? $claims["displayName"] ?? $profile["displayName"] ?? $accountId;
    $profile["email"] = $claims["email"] ?? $profile["email"] ?? "";
    $profile["updatedAt"] = date("c");
    if (!isset($profile["createdAt"])) {
        $profile["createdAt"] = date("c");
    }
    $profileDb->set($accountId, json_encode($profile, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP));
}

function oauthIdentityAccountId($identity) {
    if (!is_array($identity)) {
        return "";
    }
    $accountId = oauthNormalizeAccountId($identity["accountId"] ?? "");
    if ($accountId !== "") {
        return $accountId;
    }
    return oauthNormalizeAccountId($identity["username"] ?? "");
}

function oauthListUserIdentityKeys($accountId) {
    $identityDb = new Database(OAUTH_IDENTITY_DB_NAME);
    $keys = $identityDb->list_keys();
    if (!is_array($keys)) {
        return [];
    }

    $result = [];
    foreach ($keys as $key) {
        $identity = oauthJsonDecode($identityDb->get($key), null);
        if (is_array($identity) && oauthIdentityAccountId($identity) === $accountId) {
            $result[] = $key;
        }
    }
    return $result;
}

function oauthListUserIdentities($accountId) {
    $identityDb = new Database(OAUTH_IDENTITY_DB_NAME);
    $items = [];
    foreach (oauthListUserIdentityKeys($accountId) as $key) {
        $identity = oauthJsonDecode($identityDb->get($key), null);
        if (!is_array($identity)) {
            continue;
        }
        $identity["accountId"] = oauthIdentityAccountId($identity);
        $identity["username"] = $identity["accountId"];
        $identity["key"] = $key;
        $items[] = $identity;
    }
    return $items;
}

function oauthSafeIdentity($identity) {
    $providerName = oauthDisplayProviderName($identity);
    return [
        "key" => $identity["key"] ?? "",
        "accountId" => $identity["accountId"] ?? ($identity["username"] ?? ""),
        "username" => $identity["accountId"] ?? ($identity["username"] ?? ""),
        "providerId" => $identity["providerId"] ?? "",
        "providerName" => $providerName,
        "email" => $identity["email"] ?? "",
        "displayName" => $identity["displayName"] ?? "",
        "organizations" => $identity["organizations"] ?? [],
        "linkedAt" => $identity["linkedAt"] ?? "",
        "lastLoginAt" => $identity["lastLoginAt"] ?? ""
    ];
}

function oauthMigrateWorkspaceOwnership($fromUsername, $toUsername) {
    if (!isValidUsername($fromUsername) || !isValidUsername($toUsername) || $fromUsername === $toUsername) {
        return;
    }

    $usersDb = new Database("users");
    $filesDb = new Database("scefiles");
    $permissionsDb = new Database("file_permissions");
    $sourceKey = sanitizeDbKey($fromUsername . "_files");
    $targetKey = sanitizeDbKey($toUsername . "_files");
    $sourceFiles = $usersDb->get_array($sourceKey);
    if (!is_array($sourceFiles)) {
        $sourceFiles = [];
    }

    foreach ($sourceFiles as $fileId) {
        if (!isValidFileId($fileId)) {
            continue;
        }

        $existingTargetFiles = $usersDb->get_array($targetKey);
        if (!is_array($existingTargetFiles)) {
            $existingTargetFiles = [];
        }
        if (!in_array($fileId, $existingTargetFiles, true)) {
            $usersDb->push($targetKey, $fileId);
        }

        $raw = $filesDb->get(sanitizeDbKey($fileId));
        $fileData = oauthJsonDecode($raw, null);
        if (is_array($fileData) && isset($fileData["metadata"]) && is_array($fileData["metadata"])) {
            if (($fileData["metadata"]["author"] ?? "") === $fromUsername) {
                $fileData["metadata"]["author"] = $toUsername;
                $fileData["metadata"]["accountMergedAt"] = date("c");
                $filesDb->set(sanitizeDbKey($fileId), json_encode($fileData, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP));
            }
        }

        if (function_exists("grantFilePermission")) {
            grantFilePermission($permissionsDb, $fileId, $toUsername, "owner");
        }
    }
}

function oauthMergeAccountInto($fromAccountId, $toAccountId) {
    if (!isValidUsername($fromAccountId) || !isValidUsername($toAccountId) || $fromAccountId === $toAccountId) {
        return;
    }

    $identityDb = new Database(OAUTH_IDENTITY_DB_NAME);
    foreach (oauthListUserIdentityKeys($fromAccountId) as $identityKey) {
        $identity = oauthJsonDecode($identityDb->get($identityKey), null);
        if (!is_array($identity)) {
            continue;
        }
        $identity["accountId"] = $toAccountId;
        $identity["username"] = $toAccountId;
        $identity["mergedFrom"] = $fromAccountId;
        $identity["mergedAt"] = date("c");
        $identityDb->set($identityKey, json_encode($identity, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP));
    }

    $linkDb = oauthPasswordLinkDb();
    $linkKeys = $linkDb->list_keys();
    if (is_array($linkKeys)) {
        foreach ($linkKeys as $loginUsername) {
            if (isValidUsername($loginUsername) && $linkDb->get($loginUsername) === $fromAccountId) {
                $linkDb->set($loginUsername, $toAccountId);
            }
        }
    }

    $legacyHash = oauthGetPasswordLoginHash($fromAccountId);
    if ($legacyHash !== null) {
        oauthSetPasswordLoginLink($fromAccountId, $toAccountId);
    }

    oauthMigrateWorkspaceOwnership($fromAccountId, $toAccountId);

    $sessionDb = new Database("users_sessions");
    $sessionDb->delete($fromAccountId);

    $profileDb = new Database("user_profiles");
    $sourceProfile = getUserProfile($profileDb, $fromAccountId);
    $sourceProfile["status"] = "disabled";
    $sourceProfile["mergedInto"] = $toAccountId;
    $sourceProfile["updatedAt"] = date("c");
    $profileDb->set($fromAccountId, json_encode($sourceProfile, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP));

    oauthEnsureAccountProfile($toAccountId);
}

function oauthMergeExternalUserInto($fromUsername, $toUsername) {
    oauthMergeAccountInto($fromUsername, $toUsername);
}

function oauthConsumeState($state) {
    $db = new Database(OAUTH_STATE_DB_NAME);
    $key = sanitizeDbKey($state);
    $payload = oauthJsonDecode($db->get($key), null);
    $db->delete($key);

    if (!is_array($payload) || time() > (int)($payload["expiresAt"] ?? 0)) {
        return null;
    }

    return $payload;
}

function oauthTokenRequest($provider, $tokenEndpoint, $code, $redirectUri) {
    $form = [
        "grant_type" => "authorization_code",
        "code" => $code,
        "redirect_uri" => $redirectUri,
        "client_id" => $provider["clientId"]
    ];
    $headers = ["Content-Type: application/x-www-form-urlencoded"];

    if (($provider["tokenAuthMethod"] ?? "client_secret_post") === "client_secret_basic") {
        $headers[] = "Authorization: Basic " . base64_encode($provider["clientId"] . ":" . ($provider["clientSecret"] ?? ""));
    } else {
        $form["client_secret"] = $provider["clientSecret"] ?? "";
    }

    return oauthHttpJson($tokenEndpoint, [
        "method" => "POST",
        "headers" => $headers,
        "body" => http_build_query($form)
    ]);
}

function oauthUserInfoRequest($userInfoEndpoint, $accessToken) {
    return oauthHttpJson($userInfoEndpoint, [
        "headers" => ["Authorization: Bearer " . $accessToken]
    ]);
}

function oauthEmailAllowed($email, $allowedDomains) {
    if (empty($allowedDomains)) {
        return true;
    }
    if (!is_string($email) || strpos($email, "@") === false) {
        return false;
    }
    $domain = strtolower(substr(strrchr($email, "@"), 1));
    foreach ($allowedDomains as $allowedDomain) {
        if ($domain === strtolower(ltrim((string)$allowedDomain, "@"))) {
            return true;
        }
    }
    return false;
}

function oauthOrganizationsFromClaims($claims) {
    $items = [];
    foreach (["owner", "organization", "org", "groups", "roles"] as $key) {
        if (!isset($claims[$key])) {
            continue;
        }
        $value = $claims[$key];
        if (is_array($value)) {
            foreach ($value as $item) {
                if (is_string($item) && trim($item) !== "") {
                    $items[] = trim($item);
                }
            }
        } elseif (is_string($value) && trim($value) !== "") {
            $items[] = trim($value);
        }
    }
    return array_values(array_unique($items));
}

function oauthOrganizationAllowed($claims, $allowedOrganizations) {
    if (empty($allowedOrganizations)) {
        return true;
    }
    $actual = oauthOrganizationsFromClaims($claims);
    foreach ($actual as $item) {
        foreach ($allowedOrganizations as $allowed) {
            if (strtolower($item) === strtolower((string)$allowed)) {
                return true;
            }
        }
    }
    return false;
}

function oauthIdentityKey($providerId, $issuer, $sub) {
    return sanitizeDbKey($providerId . "_" . hash("sha256", $issuer . "|" . $sub));
}

function oauthGenerateUsername($providerId, $issuer, $sub) {
    return oauthGenerateAccountId($providerId . "|" . $issuer . "|" . $sub);
}

function oauthCreateSession($accountId) {
    $sessionDb = new Database("users_sessions");
    $token = bin2hex(random_bytes(32));
    $expiry = time() + (OAUTH_SESSION_EXPIRY_DAYS * 86400);
    $sessionDb->set($accountId, json_encode([
        "tokenHash" => hash("sha256", $token),
        "expiry" => $expiry
    ]));
    setAppCookie("sce_username", $accountId, OAUTH_SESSION_EXPIRY_DAYS, true);
    setAppCookie("sce_token", $token, OAUTH_SESSION_EXPIRY_DAYS, true);
}

function oauthWriteIdentity($provider, $claims, $accountId, $existing = null) {
    $sub = isset($claims["sub"]) ? trim((string)$claims["sub"]) : "";
    if ($sub === "" || !isValidUsername($accountId)) {
        throw new Exception("OAuth identity input invalid");
    }

    $identityDb = new Database(OAUTH_IDENTITY_DB_NAME);
    $identityKey = oauthIdentityKey($provider["id"], $provider["issuer"], $sub);
    $identity = [
        "accountId" => $accountId,
        "username" => $accountId,
        "providerId" => $provider["id"],
        "providerName" => $provider["name"] ?? $provider["id"],
        "issuer" => $provider["issuer"],
        "sub" => $sub,
        "email" => $claims["email"] ?? "",
        "displayName" => $claims["name"] ?? $claims["displayName"] ?? "",
        "organizations" => oauthOrganizationsFromClaims($claims),
        "linkedAt" => is_array($existing) && isset($existing["linkedAt"]) ? $existing["linkedAt"] : date("c"),
        "lastLoginAt" => date("c")
    ];
    if (is_array($existing) && isset($existing["mergedFrom"])) {
        $identity["mergedFrom"] = $existing["mergedFrom"];
    }
    $identityDb->set($identityKey, json_encode($identity, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP));
    oauthUpdateUserProfileAuthSource($accountId, $provider["id"], $claims);
    return $identity;
}

function oauthLinkIdentityToUser($provider, $claims, $targetAccountId, $confirmMerge = false) {
    if (!isValidUsername($targetAccountId)) {
        throw new Exception("Invalid target username");
    }

    $sub = isset($claims["sub"]) ? trim((string)$claims["sub"]) : "";
    if ($sub === "") {
        throw new Exception("OAuth userinfo missing sub");
    }

    $existing = oauthGetIdentity($provider["id"], $provider["issuer"], $sub);
    $existingAccountId = oauthIdentityAccountId($existing);
    if ($existingAccountId !== "" && $existingAccountId !== $targetAccountId) {
        $profileDb = new Database("user_profiles");
        if (isUserDisabled($profileDb, $existingAccountId)) {
            throw new Exception("OAuth identity source account disabled");
        }
        if (!$confirmMerge) {
            throw new Exception("OAuth identity merge required");
        }
        oauthMergeAccountInto($existingAccountId, $targetAccountId);
    }

    return oauthWriteIdentity($provider, $claims, $targetAccountId, $existing);
}

function oauthLoginOrProvisionIdentity($provider, $claims) {
    $sub = isset($claims["sub"]) ? trim((string)$claims["sub"]) : "";
    if ($sub === "") {
        throw new Exception("OAuth userinfo missing sub");
    }

    $issuer = $provider["issuer"];
    $providerId = $provider["id"];
    $existing = oauthGetIdentity($providerId, $issuer, $sub);
    $existingAccountId = oauthIdentityAccountId($existing);

    if ($existingAccountId !== "") {
        $accountId = $existingAccountId;
    } else {
        if (!($provider["autoProvision"] ?? true)) {
            throw new Exception("OAuth identity is not linked");
        }
        $accountId = oauthGenerateUsername($providerId, $issuer, $sub);
    }

    $profileDb = new Database("user_profiles");
    if (isUserDisabled($profileDb, $accountId)) {
        throw new Exception("User disabled");
    }

    oauthEnsureAccountProfile($accountId, $claims);
    return oauthWriteIdentity($provider, $claims, $accountId, $existing);
}
?>
