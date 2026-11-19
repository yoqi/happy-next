import { describe, expect, it } from 'vitest';
import {
  ANTIGRAVITY_PATH_ENV,
  isAntigravityAuthError,
  resolveAntigravityCommand,
} from './constants';

describe('resolveAntigravityCommand', () => {
  it('prefers the explicit path override', () => {
    expect(resolveAntigravityCommand({ [ANTIGRAVITY_PATH_ENV]: ' /custom/agy ' })).toBe('/custom/agy');
  });

  it('falls back to the bare command name when no executable is found', () => {
    expect(resolveAntigravityCommand({ PATH: '/nonexistent', HOME: '/nonexistent' })).toBe('agy');
  });
});

describe('isAntigravityAuthError', () => {
  it('matches sign-in errors case-insensitively', () => {
    expect(isAntigravityAuthError('Error: Not logged in. Run agy acp --login')).toBe(true);
    expect(isAntigravityAuthError('AUTHENTICATION REQUIRED')).toBe(true);
    expect(isAntigravityAuthError('No such file or directory')).toBe(false);
  });
});
