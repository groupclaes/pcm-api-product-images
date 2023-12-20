import sql from 'mssql'
import db from '../db'
import { FastifyBaseLogger } from 'fastify'

const DB_NAME = 'PCM'

export default class Document {
  schema: string = '[document].'
  _logger: FastifyBaseLogger

  constructor(logger: FastifyBaseLogger) { this._logger = logger }

  async getGuidByParams(company: string, objecttype: string, documenttype: string, itemnum: string, language: string, size: string): Promise<{ error?: string | null, verified?: boolean, result: any }> {
    const r = new sql.Request(await db.get(DB_NAME))
    r.input('company', sql.VarChar, company)
    r.input('objecttype', sql.VarChar, objecttype)
    r.input('documenttype', sql.VarChar, documenttype)
    r.input('itemnum', sql.VarChar, itemnum)
    r.input('language', sql.VarChar, language)
    r.input('size', sql.VarChar, size)
    const result = await r.execute('GetDocumentGuidByParams')

    if (result.recordsets[1] && result.recordsets[1].length > 0 && result.recordsets[1][0]) {
      return {
        error: result.recordset[0].error,
        verified: result.recordset[0].verified,
        result: result.recordsets[1][0][0] || []
      }
    }
    return { result: { guid: '6258fae1-fbd0-45f1-8aef-68b76a30276e' } }
  }
}