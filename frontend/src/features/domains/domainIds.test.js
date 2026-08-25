import assert from 'node:assert/strict'
import { domainIdsText, parseDomainIdsInput } from './domainIds.js'

assert.deepEqual(parseDomainIdsInput('99, 0, 1, 2, 3'), {
  domainIds: [0, 1, 2, 3, 99],
})
assert.deepEqual(parseDomainIdsInput(' 2,2, 0 '), { domainIds: [0, 2] })
assert.match(parseDomainIdsInput('1, hello').error, /0~232/)
assert.match(parseDomainIdsInput('233').error, /0~232/)
assert.equal(domainIdsText([0, 2, 99]), '0, 2, 99')

console.log('Domain ID input tests passed')
