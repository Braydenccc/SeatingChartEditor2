<?php
const DAV_PROXY_READ_CHUNK_BYTES = 8192;

function packedIpHasHexPrefix($packedIp, $hexPrefix) {
    $prefix = @hex2bin($hexPrefix);
    return is_string($prefix) && substr($packedIp, 0, strlen($prefix)) === $prefix;
}

function isDeniedIpv6TransitionAddress($packedIp) {
    if (!is_string($packedIp) || strlen($packedIp) !== 16) {
        return true;
    }

    $deniedPrefixes = [
        '00000000000000000000ffff', // IPv4-mapped IPv6 (::ffff:0:0/96)
        '000000000000000000000000', // IPv4-compatible IPv6 (::/96)
        '0064ff9b0000000000000000', // NAT64 well-known prefix (64:ff9b::/96)
        '0064ff9b0001',             // NAT64 local-use prefix (64:ff9b:1::/48)
        '2002',                     // 6to4 (2002::/16)
        '20010000'                  // Teredo (2001:0000::/32)
    ];
    foreach ($deniedPrefixes as $prefix) {
        if (packedIpHasHexPrefix($packedIp, $prefix)) {
            return true;
        }
    }

    $isatapMarker = bin2hex(substr($packedIp, 8, 4));
    return $isatapMarker === '00005efe' || $isatapMarker === '02005efe';
}

function supportsGlobalIpRangeValidation() {
    return defined('FILTER_FLAG_GLOBAL_RANGE');
}

function isPublicIpAddress($ip) {
    if (!supportsGlobalIpRangeValidation()) {
        return false;
    }

    $globalRangeFlag = constant('FILTER_FLAG_GLOBAL_RANGE');
    $normalizedIp = trim((string)$ip, "[] \t\n\r\0\x0B");
    if (filter_var($normalizedIp, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        return filter_var(
            $normalizedIp,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_IPV4 | $globalRangeFlag
        ) !== false;
    }

    if (!filter_var($normalizedIp, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        return false;
    }
    $packedIp = @inet_pton($normalizedIp);
    if ($packedIp === false || isDeniedIpv6TransitionAddress($packedIp)) {
        return false;
    }

    return filter_var(
        $normalizedIp,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_IPV6 | $globalRangeFlag
    ) !== false;
}

function normalizeIpAddress($ip) {
    $normalized = trim((string)$ip, "[] \t\n\r\0\x0B");
    return filter_var($normalized, FILTER_VALIDATE_IP) ? $normalized : null;
}

function ipAddressesMatch($left, $right) {
    $leftPacked = @inet_pton((string)$left);
    $rightPacked = @inet_pton((string)$right);
    return $leftPacked !== false && $rightPacked !== false && $leftPacked === $rightPacked;
}

function buildCurlResolveEntry($host, $port, $ip) {
    $curlAddress = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) ? '[' . $ip . ']' : $ip;
    return $host . ':' . $port . ':' . $curlAddress;
}

function readLimitedRequestBody($stream, $maxBytes) {
    if (!is_resource($stream) || $maxBytes < 0) {
        return ['success' => false, 'tooLarge' => false, 'body' => ''];
    }

    $body = '';
    $bytesRead = 0;
    while (!feof($stream)) {
        $chunk = fread($stream, DAV_PROXY_READ_CHUNK_BYTES);
        if ($chunk === false) {
            return ['success' => false, 'tooLarge' => false, 'body' => ''];
        }
        if ($chunk === '') {
            if (feof($stream)) {
                break;
            }
            return ['success' => false, 'tooLarge' => false, 'body' => ''];
        }

        $chunkBytes = strlen($chunk);
        if ($bytesRead > $maxBytes - $chunkBytes) {
            return ['success' => false, 'tooLarge' => true, 'body' => ''];
        }
        $body .= $chunk;
        $bytesRead += $chunkBytes;
    }

    return ['success' => true, 'tooLarge' => false, 'body' => $body];
}
