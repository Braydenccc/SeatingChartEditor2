const proxyConfig = require('./fuckseats-proxy.config.json');

const localHosts = new Set((proxyConfig.localHosts || []).map(host => String(host).toLowerCase()));
const allowedPorts = new Set((proxyConfig.allowedPorts || []).map(port => Number(port)));
const allowedPathPatterns = (proxyConfig.allowedPathPatterns || []).map(pattern => new RegExp(pattern));

function isAllowedFuckSeatsProxyTarget(targetUrl) {
  const host = String(targetUrl.hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
  const port = Number(targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80));
  const path = targetUrl.pathname || '/';

  return targetUrl.protocol === 'http:' &&
    localHosts.has(host) &&
    allowedPorts.has(port) &&
    targetUrl.search === '' &&
    allowedPathPatterns.some(pattern => pattern.test(path));
}

module.exports = {
  proxyConfig,
  isAllowedFuckSeatsProxyTarget
};
