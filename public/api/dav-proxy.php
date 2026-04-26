<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PROPFIND, MKCOL, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Depth, x-dav-url, X-CSRF-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$davUrl = $_SERVER['HTTP_X_DAV_URL'] ?? '';
if (empty($davUrl)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing x-dav-url header']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$headers = [];

if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $headers[] = 'Authorization: ' . $_SERVER['HTTP_AUTHORIZATION'];
}

if (isset($_SERVER['HTTP_DEPTH'])) {
    $headers[] = 'Depth: ' . $_SERVER['HTTP_DEPTH'];
}

if (isset($_SERVER['HTTP_CONTENT_TYPE'])) {
    $headers[] = 'Content-Type: ' . $_SERVER['HTTP_CONTENT_TYPE'];
}

$body = file_get_contents('php://input');

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $davUrl);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

if (!empty($body)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    http_response_code(502);
    echo json_encode(['error' => 'WebDAV proxy error: ' . $error]);
    exit;
}

$responseHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

$headerLines = explode("\r\n", $responseHeaders);
foreach ($headerLines as $line) {
    if (stripos($line, 'Content-Type:') === 0) {
        header($line);
    }
}

http_response_code($httpCode);
echo $responseBody;
