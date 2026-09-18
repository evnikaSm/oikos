import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInvitationLink, validInviteToken } from '../src/lib/invitations.ts';
const origin='https://oikos.example';
const token='11111111-1111-4111-8111-111111111111';
test('accepts a copied household link with surrounding whitespace',()=>{
 assert.equal(parseInvitationLink(`  ${origin}/?invite=${token}  `,origin),token);
 assert.equal(parseInvitationLink(`http://localhost:3000/?invite=${token}`,'http://localhost:3000'),token);
});
test('rejects invalid, duplicate and foreign invitation destinations',()=>{
 for(const link of ['not a link',`${origin}/?invite=invalid`,`${origin}/?invite=${token}&invite=${token}`,`https://other.example/?invite=${token}`,`javascript:alert(1)`,`${origin}/other?invite=${token}`,`https://user:pass@oikos.example/?invite=${token}`]) assert.equal(parseInvitationLink(link,origin),null);
 assert.equal(validInviteToken('bad-token'),false);
});
