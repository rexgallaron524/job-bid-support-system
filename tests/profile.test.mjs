import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_PROFILE, profileSchema, profileText } from '../lib/profile.ts';

test('master profile preserves detailed career history and rejects unknown fields', () => {
  const input = { ...EMPTY_PROFILE, fullName: '  Alex Example ', experience: 'First role\n成果: 日本語\n\nSecond role', skills: 'TypeScript, PostgreSQL' };
  const saved = profileSchema.parse(input);
  assert.equal(saved.fullName, 'Alex Example');
  assert.equal(saved.experience, input.experience);
  assert.equal(profileSchema.safeParse({ ...input, userId: 'somebody-else' }).success, false);
  assert.equal(profileSchema.safeParse({ ...input, experience: 'x'.repeat(30001) }).success, false);
});
test('profile contact links reject executable protocols and credentials', () => {
  for (const value of ['javascript:alert(1)', 'file:///D:/private', 'https://user:password@example.com']) {
    assert.equal(profileSchema.safeParse({ ...EMPTY_PROFILE, linkedInUrl: value }).success, false);
  }
  assert.equal(profileSchema.safeParse({ ...EMPTY_PROFILE, contactEmail: 'not-email' }).success, false);
  assert.equal(profileSchema.safeParse({ ...EMPTY_PROFILE, linkedInUrl: 'https://www.linkedin.com/in/alex' }).success, true);
});
test('profile text includes all populated sections as Unicode with Windows newlines', () => {
  const text = profileText({ ...EMPTY_PROFILE, fullName: 'Alex', headline: 'Engineer', experience: 'Built tools.\n日本語', additionalInfo: 'Professional membership' });
  assert.match(text, /Alex\r\n\r\nEngineer/);
  assert.match(text, /WORK EXPERIENCE\r\nBuilt tools\.\r\n日本語/);
  assert.match(text, /ADDITIONAL CAREER INFORMATION\r\nProfessional membership/);
  assert.doesNotMatch(text, /EDUCATION/);
  assert.doesNotMatch(text.replaceAll('\r\n', ''), /\n/);
});
