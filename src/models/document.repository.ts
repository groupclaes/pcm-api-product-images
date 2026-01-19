import { FastifyBaseLogger } from 'fastify'
import sql from 'mssql'

export default class Document {
  _logger: FastifyBaseLogger
  _pool: sql.ConnectionPool

  constructor(logger: FastifyBaseLogger, pool: sql.ConnectionPool) {
    this._logger = logger
    this._pool = pool
  }

  async getGuidByParams(company: string, objecttype: string, documenttype: string, itemnum: string, language: string, size: string): Promise<{
    error?: string | null,
    verified?: boolean,
    result: any
  }> {
    const r = this._pool.request()
    r.input('company', sql.VarChar, company)
    r.input('objecttype', sql.VarChar, objecttype)
    r.input('documenttype', sql.VarChar, documenttype)
    r.input('itemnum', sql.VarChar, itemnum)
    r.input('language', sql.VarChar, language)
    r.input('size', sql.VarChar, size)

    try {
      const result = await r.execute('GetDocumentGuidByParams')
      if (result.recordsets[1] && result.recordsets[1].length > 0 && result.recordsets[1][0]) {
        return {
          error: result.recordset[0].error,
          verified: result.recordset[0].verified,
          result: result.recordsets[1][0][0] || []
        }
      }
    } catch {
      this._logger.error('failed to get document guid!')
    }
    this._logger.debug('falling back to 404 image UUID: "6258fae1-fbd0-45f1-8aef-68b76a30276e"!')
    return { result: { guid: '6258fae1-fbd0-45f1-8aef-68b76a30276e' } }
  }
}
