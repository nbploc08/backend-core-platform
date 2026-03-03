export const RATE_LIMIT_KEY = 'rate_limit';
export const RATE_LIMITER_OPTIONS = 'RATE_LIMITER_OPTIONS';

/**
 * Atomic Lua script for fixed-window rate limiting.
 *
 * KEYS[1] = rate limit key
 * ARGV[1] = max allowed requests (limit)
 * ARGV[2] = window duration in milliseconds
 *
 * Returns: [allowed (0|1), current_count, ttl_ms]
 */
export const RATE_LIMIT_LUA_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local current = tonumber(redis.call('GET', key) or '0')
if current >= limit then
  local ttl = redis.call('PTTL', key)
  if ttl < 0 then ttl = window end
  return {0, current, ttl}
end

local count = redis.call('INCR', key)
if count == 1 then
  redis.call('PEXPIRE', key, window)
end

return {1, count, redis.call('PTTL', key)}
`;
