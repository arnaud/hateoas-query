/* globals test expect */

const hateoas = require('../dist/hateoas-query')

test('Required lib', () => {
  expect(hateoas).toBeTruthy()
})

test('Query with selectors', async () => {
  const query = hateoas({ request: { a: { b: { c: 'value' } } } })
  expect(query).toBeTruthy()

  const data = await query({ a: { b: { c: 'value' } } }, 'a.b.c')
  expect(data).toEqual('value')
})
