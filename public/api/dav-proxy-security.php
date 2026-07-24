<?php
const DAV_PROXY_READ_CHUNK_BYTES = 8192;

function packedIpHasHexPrefix($packedIp, $hexPrefix) {
    $prefix = @hex2bin($hexPrefix);
    return is_string($prefix) && substr($packedIp, 0, strlen($prefix)) === $prefix;
}

function packedIpMatchesCidr($packedIp, $networkHex, $prefixLength) {
    $network = @hex2bin($networkHex);
    if (!is_string($packedIp) || !is_string($network) || strlen($packedIp) !== strlen($network)) {
        return false;
    }

    $maxPrefixLength = strlen($packedIp) * 8;
    $prefixLength = (int)$prefixLength;
    if ($prefixLength < 0 || $prefixLength > $maxPrefixLength) {
        return false;
    }

    $wholeBytes = (int)floor($prefixLength / 8);
    if ($wholeBytes > 0 && substr($packedIp, 0, $wholeBytes) !== substr($network, 0, $wholeBytes)) {
        return false;
    }

    $remainingBits = $prefixLength % 8;
    if ($remainingBits === 0) {
        return true;
    }

    $mask = (0xff << (8 - $remainingBits)) & 0xff;
    return (ord($packedIp[$wholeBytes]) & $mask) === (ord($network[$wholeBytes]) & $mask);
}

function isDeniedIpv6TransitionAddress($packedIp) {
    if (!is_string($packedIp) || strlen($packedIp) !== 16) {
        return true;
    }

    $deniedPrefixes = [
        '00000000000000000000ffff', // IPv4-mapped IPv6 (::ffff:0:0/96)
        '000000000000000000000000', // IPv4-compatible IPv6 (::/96)
        '0000000000000000ffff0000', // IPv4-translatable IPv6 (::ffff:0:0:0/96)
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

function isPublicIpv4AddressFallback($packedIp) {
    if (!is_string($packedIp) || strlen($packedIp) !== 4) {
        return false;
    }

    // These two addresses are the globally reachable PCP and TURN anycast
    // exceptions inside the otherwise non-global 192.0.0.0/24 block.
    $packedHex = bin2hex($packedIp);
    if ($packedHex === 'c0000009' || $packedHex === 'c000000a') {
        return true;
    }

    static $deniedCidrs = [
        ['00000000', 8],  // 0.0.0.0/8: current network and unspecified
        ['0a000000', 8],  // 10.0.0.0/8: private use
        ['64400000', 10], // 100.64.0.0/10: shared address space
        ['7f000000', 8],  // 127.0.0.0/8: loopback
        ['a9fe0000', 16], // 169.254.0.0/16: link-local
        ['ac100000', 12], // 172.16.0.0/12: private use
        ['c0000000', 24], // 192.0.0.0/24: IETF protocol assignments
        ['c0000200', 24], // 192.0.2.0/24: documentation
        ['c0586300', 24], // 192.88.99.0/24: deprecated 6to4 transition
        ['c0a80000', 16], // 192.168.0.0/16: private use
        ['c6120000', 15], // 198.18.0.0/15: benchmark testing
        ['c6336400', 24], // 198.51.100.0/24: documentation
        ['cb007100', 24], // 203.0.113.0/24: documentation
        ['e0000000', 4],  // 224.0.0.0/4: multicast
        ['f0000000', 4]   // 240.0.0.0/4: reserved and limited broadcast
    ];

    foreach ($deniedCidrs as $cidr) {
        if (packedIpMatchesCidr($packedIp, $cidr[0], $cidr[1])) {
            return false;
        }
    }

    return true;
}

function isPublicIpv6AddressFallback($packedIp) {
    if (!is_string($packedIp) || strlen($packedIp) !== 16) {
        return false;
    }

    // Known globally reachable exceptions within 2001::/23. The parent block
    // remains denied below so unknown or future protocol assignments fail closed.
    static $globalProtocolCidrs = [
        ['20010001000000000000000000000001', 128], // PCP anycast
        ['20010001000000000000000000000002', 128], // TURN anycast
        ['20010003000000000000000000000000', 32],  // AMT
        ['20010004011200000000000000000000', 48],  // AS112-v6
        ['20010020000000000000000000000000', 28],  // ORCHIDv2
        ['20010030000000000000000000000000', 28]   // Drone Remote ID protocol
    ];

    static $deniedCidrs = [
        ['00000000000000000000000000000000', 128], // Unspecified (::/128)
        ['00000000000000000000000000000001', 128], // Loopback (::1/128)
        ['00000000000000000000000000000000', 96],  // IPv4-compatible (::/96)
        ['00000000000000000000ffff00000000', 96],  // IPv4-mapped (::ffff:0:0/96)
        ['0064ff9b000000000000000000000000', 96],  // NAT64 well-known prefix
        ['0064ff9b000100000000000000000000', 48],  // NAT64 local-use prefix
        ['01000000000000000000000000000000', 64],  // Discard-only prefix
        ['20010000000000000000000000000000', 32],  // Teredo transition
        ['20010002000000000000000000000000', 48],  // Benchmark testing
        ['20010010000000000000000000000000', 28],  // Deprecated ORCHID
        ['20010000000000000000000000000000', 23],  // Other IETF protocol assignments fail closed
        ['20010db8000000000000000000000000', 32],  // Documentation
        ['20020000000000000000000000000000', 16],  // 6to4 transition
        ['3fff0000000000000000000000000000', 20],  // Documentation
        ['fc000000000000000000000000000000', 7],   // Unique-local
        ['fe800000000000000000000000000000', 10],  // Link-local
        ['fec00000000000000000000000000000', 10], // Deprecated site-local
        ['ff000000000000000000000000000000', 8]    // Multicast
    ];

    if (isDeniedIpv6TransitionAddress($packedIp)) {
        return false;
    }

    foreach ($globalProtocolCidrs as $cidr) {
        if (packedIpMatchesCidr($packedIp, $cidr[0], $cidr[1])) {
            return true;
        }
    }

    foreach ($deniedCidrs as $cidr) {
        if (packedIpMatchesCidr($packedIp, $cidr[0], $cidr[1])) {
            return false;
        }
    }

    // On runtimes without FILTER_FLAG_GLOBAL_RANGE, only the allocated global
    // unicast space is accepted. Future or unknown address families fail closed.
    return packedIpMatchesCidr(
        $packedIp,
        '20000000000000000000000000000000',
        3
    );
}

function isPublicIpAddressFallback($normalizedIp) {
    if (filter_var($normalizedIp, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        $packedIp = @inet_pton($normalizedIp);
        return $packedIp !== false && isPublicIpv4AddressFallback($packedIp);
    }

    if (filter_var($normalizedIp, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        $packedIp = @inet_pton($normalizedIp);
        return $packedIp !== false && isPublicIpv6AddressFallback($packedIp);
    }

    return false;
}

function isPublicIpAddress($ip, $forceFallback = false) {
    $normalizedIp = trim((string)$ip, "[] \t\n\r\0\x0B");
    $isIpv4 = filter_var($normalizedIp, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false;
    $isIpv6 = !$isIpv4 && filter_var($normalizedIp, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false;
    if (!$isIpv4 && !$isIpv6) {
        return false;
    }

    $packedIp = @inet_pton($normalizedIp);
    if ($packedIp === false || ($isIpv6 && isDeniedIpv6TransitionAddress($packedIp))) {
        return false;
    }

    if (!$forceFallback && supportsGlobalIpRangeValidation()) {
        $globalRangeFlag = constant('FILTER_FLAG_GLOBAL_RANGE');
        $versionFlag = $isIpv4 ? FILTER_FLAG_IPV4 : FILTER_FLAG_IPV6;
        return filter_var(
            $normalizedIp,
            FILTER_VALIDATE_IP,
            $versionFlag | $globalRangeFlag
        ) !== false;
    }

    return isPublicIpAddressFallback($normalizedIp);
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
