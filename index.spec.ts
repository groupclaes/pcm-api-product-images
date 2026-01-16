import server from './src'

describe('index.ts', () => {
  test('should return undefined if the configuration is invalid', async () => {
    let srv = await server()
    expect(srv).toBeUndefined()
  })
})
