import assert from 'node:assert/strict'
import test from 'node:test'
import { appendMissingInOrder, sameMembers, sameOrder } from '../src/order.js'

test('detects a reversed batch with the same members', () => {
  assert.equal(sameMembers(['1', '2', '3'], ['3', '2', '1']), true)
  assert.equal(sameOrder(['1', '2', '3'], ['3', '2', '1']), false)
})

test('preserves requested append order and skips existing IDs', () => {
  assert.deepEqual(appendMissingInOrder(['10', '20'], ['40', '30', '20']), ['10', '20', '40', '30'])
})

test('member comparison handles duplicate counts', () => {
  assert.equal(sameMembers(['1', '1', '2'], ['1', '2', '2']), false)
})
