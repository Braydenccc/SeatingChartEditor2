<?php
require_once "api/dav-proxy-security.php";

function davFixtureAssert($condition, $message) {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$deniedAddresses = [
    '127.0.0.1',
    '10.0.0.1',
    '100.64.0.1',
    '169.254.1.1',
    '192.0.0.1',
    '192.0.2.1',
    '192.88.99.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '::ffff:8.8.8.8',
    '::8.8.8.8',
    '64:ff9b::7f00:1',
    '64:ff9b:1::7f00:1',
    '2002:7f00:1::',
    '2001:0000:4136:e378:8000:63bf:3fff:fdd2',
    '2001:4860:4860:0:200:5efe:7f00:1'
];
davFixtureAssert(supportsGlobalIpRangeValidation(), 'runtime provides FILTER_FLAG_GLOBAL_RANGE');
foreach ($deniedAddresses as $address) {
    davFixtureAssert(!isPublicIpAddress($address), "denied address {$address}");
}

davFixtureAssert(isPublicIpAddress('8.8.8.8'), 'public IPv4 address is allowed');
davFixtureAssert(isPublicIpAddress('2606:4700:4700::1111'), 'native public IPv6 address is allowed');
davFixtureAssert(
    ipAddressesMatch('2606:4700:4700::1111', '2606:4700:4700:0:0:0:0:1111'),
    'equivalent IPv6 spellings match in packed form'
);
davFixtureAssert(
    buildCurlResolveEntry('dav.example.test', 443, '2606:4700:4700::1111') ===
        'dav.example.test:443:[2606:4700:4700::1111]',
    'IPv6 cURL resolve entry preserves host and TLS name while bracketing the address'
);

$exactStream = fopen('php://temp', 'w+b');
fwrite($exactStream, str_repeat('a', 16));
rewind($exactStream);
$exactResult = readLimitedRequestBody($exactStream, 16);
fclose($exactStream);
davFixtureAssert($exactResult['success'] && !$exactResult['tooLarge'], 'exact request limit is accepted');
davFixtureAssert(strlen($exactResult['body']) === 16, 'exact request body is preserved');

$oversizedStream = fopen('php://temp', 'w+b');
fwrite($oversizedStream, str_repeat('b', 17));
rewind($oversizedStream);
$oversizedResult = readLimitedRequestBody($oversizedStream, 16);
fclose($oversizedStream);
davFixtureAssert(!$oversizedResult['success'] && $oversizedResult['tooLarge'], 'actual bytes over the limit are rejected');
davFixtureAssert($oversizedResult['body'] === '', 'oversized request body is not returned for forwarding');

echo "dav proxy security contract fixture passed\n";
