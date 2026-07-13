/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'chore', 'ci', 'build', 'revert'],
    ],
    // Allowed scopes = package / area names. Add a new package's name here when it lands.
    'scope-enum': [2, 'always', ['core', 'deps', 'repo', 'release', 'ci']],
  },
}
