<?php

class Database {
    private static $values = [];
    private static $arrays = [];
    private static $throwOnNextGet = [];
    private $name;

    public static function throwOnNextGet($databaseName, $key) {
        self::$throwOnNextGet[$databaseName][$key] = true;
    }

    public function __construct($name) {
        $this->name = $name;
        if (!isset(self::$values[$name])) self::$values[$name] = [];
        if (!isset(self::$arrays[$name])) self::$arrays[$name] = [];
    }

    public function get($key) {
        if (!empty(self::$throwOnNextGet[$this->name][$key])) {
            unset(self::$throwOnNextGet[$this->name][$key]);
            throw new RuntimeException('fixture get failed after write');
        }
        return self::$values[$this->name][$key] ?? null;
    }

    public function set($key, $value) {
        self::$values[$this->name][$key] = $value;
        return true;
    }

    public function delete($key, $value = null) {
        if ($value === null) {
            unset(self::$values[$this->name][$key], self::$arrays[$this->name][$key]);
            return true;
        }

        $items = self::$arrays[$this->name][$key] ?? [];
        self::$arrays[$this->name][$key] = array_values(array_filter($items, function($item) use ($value) {
            return $item !== $value;
        }));
        return true;
    }

    public function list_keys() {
        return array_values(array_unique(array_merge(
            array_keys(self::$values[$this->name]),
            array_keys(self::$arrays[$this->name])
        )));
    }

    public function search_value($pattern) { return []; }

    public function push($key, $value) {
        if (!isset(self::$arrays[$this->name][$key])) self::$arrays[$this->name][$key] = [];
        self::$arrays[$this->name][$key][] = $value;
        return true;
    }

    public function get_array($key) {
        return self::$arrays[$this->name][$key] ?? null;
    }
}

require_once "api/common.php";
require_once "api/file-permissions.php";

function fixtureAssert($condition, $message) {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$boundedDb = new Database('fixture_bounded');
fixtureAssert(databasePushBounded($boundedDb, 'events', 'one', 2), 'first bounded push');
fixtureAssert(databasePushBounded($boundedDb, 'events', 'two', 2), 'second bounded push');
fixtureAssert(databasePushBounded($boundedDb, 'events', 'three', 2), 'third bounded push');
fixtureAssert($boundedDb->get_array('events') === ['two', 'three'], 'bounded array keeps newest entries');

$rateDb = new Database('fixture_rate');
$firstRate = consumeAtomicRateLimitAttempt($rateDb, 'login_user', 300, 2);
$secondRate = consumeAtomicRateLimitAttempt($rateDb, 'login_user', 300, 2);
$thirdRate = consumeAtomicRateLimitAttempt($rateDb, 'login_user', 300, 2);
fixtureAssert($firstRate['ok'] && $firstRate['allowed'], 'first rate attempt allowed');
fixtureAssert($secondRate['ok'] && $secondRate['allowed'], 'second rate attempt allowed');
fixtureAssert($thirdRate['ok'] && !$thirdRate['allowed'], 'third rate attempt denied');

$sessionRevocationDb = new Database('fixture_session_revocation');
$sessionRevocationDb->set('disabled_user', '{"tokenHash":"active"}');
fixtureAssert(revokeUserSessionVerified($sessionRevocationDb, 'disabled_user'), 'session revocation is confirmed');
fixtureAssert($sessionRevocationDb->get('disabled_user') === null, 'session revocation removes the stored token');
fixtureAssert(revokeUserSessionVerified($sessionRevocationDb, 'disabled_user'), 'session revocation is idempotent when already absent');
$sessionRevocationDb->set('disabled_user', '{"tokenHash":"stale"}');
Database::throwOnNextGet('fixture_session_revocation', 'disabled_user');
fixtureAssert(!revokeUserSessionVerified($sessionRevocationDb, 'disabled_user'), 'session revocation fails closed on database read errors');
fixtureAssert($sessionRevocationDb->get('disabled_user') !== null, 'failed session revocation preserves the token for a safe retry');

$sessionStateDb = new Database('fixture_session_state');
$sessionProfileDb = new Database('fixture_session_profiles');
$sessionUsersDb = new Database('fixture_session_users');
$sessionUsername = 'epoch_user';
$sessionToken = str_repeat('a', 64);
$sessionPasswordHash = 'password-hash-v1';
$sessionEpoch = createUserSessionEpoch();
$sessionUsersDb->set($sessionUsername, $sessionPasswordHash);
$sessionProfileDb->set($sessionUsername, json_encode([
    'status' => 'active',
    'sessionEpoch' => $sessionEpoch
]));
$sessionStateDb->set($sessionUsername, json_encode([
    'tokenHash' => hash('sha256', $sessionToken),
    'expiry' => time() + 3600,
    'sessionEpoch' => $sessionEpoch,
    'credentialFingerprint' => getPasswordHashFingerprint($sessionPasswordHash)
]));
fixtureAssert(
    isAuthorized($sessionStateDb, $sessionProfileDb, $sessionUsersDb, $sessionUsername, $sessionToken),
    'session matching the current epoch and password hash is authorized'
);
$sessionProfileDb->set($sessionUsername, json_encode([
    'status' => 'active',
    'sessionEpoch' => createUserSessionEpoch()
]));
fixtureAssert(
    !isAuthorized($sessionStateDb, $sessionProfileDb, $sessionUsersDb, $sessionUsername, $sessionToken),
    'rotating the session epoch permanently invalidates the old token'
);
$sessionProfileDb->set($sessionUsername, json_encode([
    'status' => 'active',
    'sessionEpoch' => $sessionEpoch
]));
$sessionUsersDb->set($sessionUsername, 'password-hash-v2');
fixtureAssert(
    !isAuthorized($sessionStateDb, $sessionProfileDb, $sessionUsersDb, $sessionUsername, $sessionToken),
    'changing the password hash invalidates an in-flight token issued from old credentials'
);

$usersDb = new Database('fixture_users');
$profilesDb = new Database('fixture_profiles');
$sessionsDb = new Database('fixture_sessions');
$sagaUsername = 'saga_user';
$ownedRegistrationValues = [
    'account' => 'password-hash',
    'profile' => '{"status":"active"}',
    'session' => '{"tokenHash":"partial"}'
];
$usersDb->set($sagaUsername, $ownedRegistrationValues['account']);
$profilesDb->set($sagaUsername, $ownedRegistrationValues['profile']);
$sessionsDb->set($sagaUsername, $ownedRegistrationValues['session']);
$rollback = rollbackRegistrationSaga(
    $usersDb,
    $profilesDb,
    $sessionsDb,
    $sagaUsername,
    $ownedRegistrationValues
);
fixtureAssert($rollback['success'], 'registration rollback confirms every compensation step');
fixtureAssert($usersDb->get($sagaUsername) === null, 'registration rollback deletes account');
fixtureAssert($profilesDb->get($sagaUsername) === null, 'registration rollback deletes profile');
fixtureAssert($sessionsDb->get($sagaUsername) === null, 'registration rollback deletes session');

$exceptionUsersDb = new Database('fixture_exception_users');
$exceptionProfilesDb = new Database('fixture_exception_profiles');
$exceptionSessionsDb = new Database('fixture_exception_sessions');
$exceptionUsername = 'exception_user';
Database::throwOnNextGet('fixture_exception_users', $exceptionUsername);
fixtureAssert(
    !databaseSetVerified($exceptionUsersDb, $exceptionUsername, 'persisted-before-read-error'),
    'verified write converts a post-write read exception into failure'
);
$exceptionRollback = rollbackRegistrationSaga(
    $exceptionUsersDb,
    $exceptionProfilesDb,
    $exceptionSessionsDb,
    $exceptionUsername,
    ['account' => 'persisted-before-read-error']
);
fixtureAssert($exceptionRollback['success'], 'post-write exception state can be compensated');
fixtureAssert($exceptionUsersDb->get($exceptionUsername) === null, 'post-write exception account is removed');

$raceUsersDb = new Database('fixture_race_users');
$raceProfilesDb = new Database('fixture_race_profiles');
$raceSessionsDb = new Database('fixture_race_sessions');
$raceUsername = 'race_user';
$ownerAValues = [
    'account' => 'owner-a-password-hash',
    'profile' => '{"status":"active","registrationMarker":"owner-a"}',
    'session' => '{"tokenHash":"owner-a"}'
];
$ownerBValues = [
    'account' => 'owner-b-password-hash',
    'profile' => '{"status":"active","registrationMarker":"owner-b"}',
    'session' => '{"tokenHash":"owner-b"}'
];
$raceUsersDb->set($raceUsername, $ownerAValues['account']);
$raceProfilesDb->set($raceUsername, $ownerAValues['profile']);
$raceSessionsDb->set($raceUsername, $ownerAValues['session']);
$raceUsersDb->set($raceUsername, $ownerBValues['account']);
$raceProfilesDb->set($raceUsername, $ownerBValues['profile']);
$raceSessionsDb->set($raceUsername, $ownerBValues['session']);
$ownerAState = registrationStateMatchesExpected(
    $raceUsersDb,
    $raceProfilesDb,
    $raceSessionsDb,
    $raceUsername,
    $ownerAValues
);
fixtureAssert(!$ownerAState['success'], 'registration ownership check rejects overwritten state');
$ownerARollback = rollbackRegistrationSaga(
    $raceUsersDb,
    $raceProfilesDb,
    $raceSessionsDb,
    $raceUsername,
    $ownerAValues
);
fixtureAssert($ownerARollback['success'], 'stale registration rollback safely completes');
fixtureAssert($raceUsersDb->get($raceUsername) === $ownerBValues['account'], 'stale rollback preserves newer account');
fixtureAssert($raceProfilesDb->get($raceUsername) === $ownerBValues['profile'], 'stale rollback preserves newer profile');
fixtureAssert($raceSessionsDb->get($raceUsername) === $ownerBValues['session'], 'stale rollback preserves newer session');
fixtureAssert(
    $ownerARollback['outcomes'] === [
        'session' => 'ownership_changed',
        'profile' => 'ownership_changed',
        'account' => 'ownership_changed'
    ],
    'stale rollback records ownership changes'
);

$registrationLockDb = new Database('fixture_registration_locks');
$ownerALease = acquireRegistrationLease(
    $registrationLockDb,
    'lease_user',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
);
fixtureAssert($ownerALease !== null, 'first registration owner acquires the username lease');
$securityLease = acquireUserSecurityLease($registrationLockDb, 'lease_user');
fixtureAssert($securityLease === null, 'account security mutation shares the registration username lease');
$ownerBLease = acquireRegistrationLease(
    $registrationLockDb,
    'lease_user',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
);
fixtureAssert($ownerBLease === null, 'second registration owner cannot acquire an active username lease');
fixtureAssert(releaseRegistrationLease($registrationLockDb, $ownerALease), 'first registration owner releases its lease');
$ownerBLease = acquireRegistrationLease(
    $registrationLockDb,
    'lease_user',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
);
fixtureAssert($ownerBLease !== null, 'second registration owner can acquire the released username lease');
fixtureAssert(releaseRegistrationLease($registrationLockDb, $ownerBLease), 'second registration owner releases its lease');
$securityLease = acquireUserSecurityLease($registrationLockDb, 'lease_user');
fixtureAssert($securityLease !== null, 'account security mutation acquires the released username lease');
fixtureAssert(
    releaseUserSecurityLease($registrationLockDb, $securityLease, 'lease_user', 'fixture'),
    'account security mutation releases the shared username lease'
);

$invalidUtf8 = "valid\xFFtail";
fixtureAssert(preg_match('//u', normalizeUtf8String($invalidUtf8)) === 1, 'invalid UTF-8 is normalized');
$singleLineLogText = sanitizeSingleLineLogText("user\r\nforged\0entry\tend", 80);
fixtureAssert(
    preg_match('/[\x00-\x1F\x7F]/', $singleLineLogText) === 0,
    'fallback log text removes line-breaking and control characters'
);
$truncatedUtf8 = truncateUtf8String(str_repeat('座', 10), 10, '...');
fixtureAssert(preg_match('//u', $truncatedUtf8) === 1, 'UTF-8 truncation keeps a valid string');
fixtureAssert(substr($truncatedUtf8, -3) === '...', 'UTF-8 truncation appends its suffix');
fixtureAssert(strlen($truncatedUtf8) <= 10, 'UTF-8 truncation includes suffix within the byte limit');

$securityLogEntry = encodeBoundedSecurityLogEntry(
    "register_failed\xFF",
    str_repeat('超长用户名', 2000) . "\xFF",
    "203.0.113.10\xFF",
    [
        'reason' => str_repeat('并发覆盖', 2000) . "\xFF",
        'nested' => ['value' => str_repeat('detail', 2000)]
    ],
    4096
);
$decodedSecurityLogEntry = json_decode($securityLogEntry, true);
fixtureAssert(is_array($decodedSecurityLogEntry), 'bounded security log remains valid JSON');
fixtureAssert(preg_match('//u', $securityLogEntry) === 1, 'bounded security log remains valid UTF-8');
fixtureAssert(strlen($securityLogEntry) <= 4096, 'bounded security log respects the entry byte limit');

$logoutLogEntry = encodeBoundedSecurityLogEntry(
    'logout_failed',
    str_repeat('arbitrary-username-', 10000) . "\xFF",
    '203.0.113.10',
    ['reason' => 'invalid_token'],
    4096
);
fixtureAssert(is_array(json_decode($logoutLogEntry, true)), 'logout failure log with arbitrary username remains valid JSON');
fixtureAssert(strlen($logoutLogEntry) <= 4096, 'logout failure log with arbitrary username stays bounded');

$_SERVER['REMOTE_ADDR'] = '203.0.113.10';
$_SERVER['HTTP_HOST'] = 'localhost';
fixtureAssert(!isLocalRequest(), 'spoofed localhost Host is not a local request');
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_HOST'] = 'example.invalid';
fixtureAssert(isLocalRequest(), 'loopback REMOTE_ADDR is a local request');

$_SERVER['HTTPS'] = 'off';
$_SERVER['SERVER_PORT'] = 80;
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_X_FORWARDED_PROTO'] = 'https';
putenv('TRUST_PROXY_PROTO_HEADERS=0');
fixtureAssert(!isHttpsRequest(), 'forwarded protocol is ignored without explicit trust');
putenv('TRUST_PROXY_PROTO_HEADERS=1');
fixtureAssert(isHttpsRequest(), 'forwarded protocol is accepted with explicit trust');
putenv('TRUST_PROXY_PROTO_HEADERS');

$permissionDb = new Database('fixture_permissions');
$targetFileId = 'abcdef0123456789abcdef0123456789';
$targetUsername = 'red_blue';
$collidingFileId = $targetFileId . '_red';
$collidingUsername = 'blue';
fixtureAssert(
    getLegacyFilePermissionKey($targetFileId, $targetUsername) === getLegacyFilePermissionKey($collidingFileId, $collidingUsername),
    'legacy permission keys collide for the fixture identities'
);

$permissionDb->set(getLegacyFilePermissionKey($collidingFileId, $collidingUsername), json_encode([
    'username' => $collidingUsername,
    'fileId' => $collidingFileId,
    'permission' => 'owner'
]));
fixtureAssert(
    !hasFilePermission($permissionDb, $targetFileId, $targetUsername, 'read'),
    'colliding legacy record is rejected when identity fields do not match'
);

$permissionDb->set(getLegacyFilePermissionKey($targetFileId, $targetUsername), json_encode([
    'username' => $targetUsername,
    'fileId' => $targetFileId,
    'permission' => 'owner'
]));
fixtureAssert(
    hasFilePermission($permissionDb, $targetFileId, $targetUsername, 'write'),
    'matching legacy permission remains valid'
);
fixtureAssert(
    $permissionDb->get(getFilePermissionKey($targetFileId, $targetUsername)) !== null,
    'matching legacy permission migrates to the v2 key'
);

echo "security contract fixture passed\n";
