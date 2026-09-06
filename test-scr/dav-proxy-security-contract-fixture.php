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
    '::ffff:0:8.8.8.8',
    '64:ff9b::7f00:1',
    '64:ff9b:1::7f00:1',
    '2002:7f00:1::',
    '2001:0000:4136:e378:8000:63bf:3fff:fdd2',
    '2001:4860:4860:0:200:5efe:7f00:1'
];
foreach ($deniedAddresses as $address) {
    davFixtureAssert(!isPublicIpAddress($address), "denied address {$address}");
    davFixtureAssert(!isPublicIpAddress($address, true), "fallback denied address {$address}");
}

davFixtureAssert(isPublicIpAddress('8.8.8.8'), 'public IPv4 address is allowed');
davFixtureAssert(isPublicIpAddress('2606:4700:4700::1111'), 'native public IPv6 address is allowed');
davFixtureAssert(isPublicIpAddress('8.8.8.8', true), 'fallback public IPv4 address is allowed');
davFixtureAssert(isPublicIpAddress('2606:4700:4700::1111', true), 'fallback public IPv6 address is allowed');

$fallbackDeniedBoundaryAddresses = [
    // IPv4 current, private, shared, loopback, link-local and special-use boundaries.
    '0.0.0.0',
    '0.255.255.255',
    '10.0.0.0',
    '10.255.255.255',
    '100.64.0.0',
    '100.127.255.255',
    '127.0.0.0',
    '127.255.255.255',
    '169.254.0.0',
    '169.254.255.255',
    '172.16.0.0',
    '172.31.255.255',
    '192.0.0.0',
    '192.0.0.8',
    '192.0.0.11',
    '192.0.0.255',
    '192.0.2.0',
    '192.0.2.255',
    '192.88.99.0',
    '192.88.99.255',
    '192.168.0.0',
    '192.168.255.255',
    '198.18.0.0',
    '198.19.255.255',
    '198.51.100.0',
    '198.51.100.255',
    '203.0.113.0',
    '203.0.113.255',
    '224.0.0.0',
    '239.255.255.255',
    '240.0.0.0',
    '255.255.255.255',
    // IPv6 local, special-use, documentation, transition and reserved boundaries.
    '::',
    '::1',
    '::ffff:0:0',
    '::ffff:255.255.255.255',
    '64:ff9b::',
    '64:ff9b::ffff:ffff',
    '64:ff9b:1::',
    '64:ff9b:1:ffff:ffff:ffff:ffff:ffff',
    '100::',
    '100::ffff:ffff:ffff:ffff',
    '2001::',
    '2001:1::3',
    '2001:1ff:ffff:ffff:ffff:ffff:ffff:ffff',
    '2001:2::',
    '2001:2:0:ffff:ffff:ffff:ffff:ffff',
    '2001:10::',
    '2001:1f:ffff:ffff:ffff:ffff:ffff:ffff',
    '2001:db8::',
    '2001:db8:ffff:ffff:ffff:ffff:ffff:ffff',
    '2002::',
    '2002:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    '3fff::',
    '3fff:fff:ffff:ffff:ffff:ffff:ffff:ffff',
    'fc00::',
    'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    'fe80::',
    'febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    'fec0::',
    'feff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    'ff00::',
    'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    '4000::',
    '5f00::'
];
foreach ($fallbackDeniedBoundaryAddresses as $address) {
    davFixtureAssert(!isPublicIpAddress($address, true), "fallback boundary denied address {$address}");
}

$fallbackAllowedBoundaryAddresses = [
    '1.1.1.1',
    '9.255.255.255',
    '11.0.0.0',
    '100.63.255.255',
    '100.128.0.0',
    '126.255.255.255',
    '128.0.0.0',
    '169.253.255.255',
    '169.255.0.0',
    '172.15.255.255',
    '172.32.0.0',
    '192.0.0.9',
    '192.0.0.10',
    '192.31.196.1',
    '198.17.255.255',
    '198.20.0.0',
    '223.255.255.254',
    '2001:1::1',
    '2001:1::2',
    '2001:3::1',
    '2001:4:112::1',
    '2001:20::1',
    '2001:30::1',
    '2001:4860:4860::8888',
    '2606:4700:4700::1111',
    '3fff:1000::1'
];
foreach ($fallbackAllowedBoundaryAddresses as $address) {
    davFixtureAssert(isPublicIpAddress($address, true), "fallback boundary allowed address {$address}");
}

$invalidAddresses = ['', 'not-an-ip', '999.0.0.1', '2001:::1'];
foreach ($invalidAddresses as $address) {
    davFixtureAssert(!isPublicIpAddress($address, true), "fallback invalid address {$address}");
}

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
