const TEST_HOST = 'https://test.sce.jbyc.cc';
const PATH_ALLOWED_CHARS_REGEX = /^[a-zA-Z0-9._/-]+$/;

export function normalizeDeployPath(rawPath) {
  return String(rawPath ?? '').trim().replace(/^\/+|\/+$/g, '');
}

export function validateDeploySubPath(rawPath) {
  const safePath = normalizeDeployPath(rawPath);

  if (!safePath) {
    throw new Error('部署子路径不能为空。');
  }

  if (!PATH_ALLOWED_CHARS_REGEX.test(safePath)) {
    throw new Error('部署路径仅允许字母、数字、点(.)、下划线(_)、连字符(-)和斜杠(/)。');
  }

  const pathSegments = safePath.split('/').filter(Boolean);
  for (const segment of pathSegments) {
    if (segment === 'test') {
      throw new Error('部署路径不能包含名称为 "test" 的段。');
    }

    if (segment.startsWith('.')) {
      throw new Error('部署路径段不能以点(.)开头。');
    }

    if (segment.includes('..')) {
      throw new Error('部署路径段不能包含连续点(..)。');
    }
  }

  return safePath;
}

export function resolveStagingTarget(branchName) {
  const normalizedBranch = String(branchName ?? '').trim();

  if (normalizedBranch === 'test') {
    return {
      deploySite: 'test.sce.jbyc.cc/test',
      siteUrl: `${TEST_HOST}/test`,
      deployPath: '',
    };
  }

  if (!normalizedBranch.startsWith('test-')) {
    throw new Error(`无效分支：${normalizedBranch}，必须是 test 或 test-<path>。`);
  }

  const deployPath = validateDeploySubPath(normalizedBranch.slice(5));
  return {
    deploySite: `test.sce.jbyc.cc/test/${deployPath}`,
    siteUrl: `${TEST_HOST}/test/${deployPath}`,
    deployPath,
  };
}
