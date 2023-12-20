import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import sha1 from '../crypto'
import config from './config'
import Document from '../models/document.repository'
import { env } from 'process'
import fs from 'fs'
import imageTools from '@groupclaes/pcm-imagetools'

declare module 'fastify' {
  export interface FastifyReply {
    success: (data?: any, code?: number, executionTime?: number) => FastifyReply
    fail: (data?: any, code?: number, executionTime?: number) => FastifyReply
    error: (message?: string, code?: number, executionTime?: number) => FastifyReply
  }
}
export default async function (fastify: FastifyInstance) {
  /**
   * @route /{APP_VERSION}/product-images/:guid
   */
  fastify.get('/:guid', async function (request: FastifyRequest<{ Params: { guid: string }, Querystring: { s: string } }>, reply: FastifyReply) {
    const start = performance.now()

    try {
      let repo = new Document(request.log)
      const s = request.query.s ?? 'normal'

      let options: IToolsOptions = {
        size: config.imageSizeMap[s] ?? 800,
        quality: config.imageQualityMap[s] ?? config.defaultImageQuality,
        cache: config.cacheEnabled ?? false,
        webp: (request.headers['accept'] && request.headers['accept'].indexOf('image/webp') > -1) ? true : false
      }
      let _guid = request.params.guid.toLowerCase()

      if (!/^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$/.test(_guid) && !isNaN(parseInt(_guid))) {
        const culture = 'all'
        const company = resolveCompany(request)
        const r = await repo.getGuidByParams(company, 'artikel', 'foto', request.params.guid.toLowerCase(), culture, 'any')
        if (r && r.result)
          _guid = r.result.guid.toLowerCase()

        if (_guid === '6258fae1-fbd0-45f1-8aef-68b76a30276e' && company === 'bra') {
          const r = await repo.getGuidByParams('dis', 'artikel', 'foto', request.params.guid.toLowerCase(), culture, 'any')
          if (r && r.result)
            _guid = r.result.guid.toLowerCase()
        }

        if (_guid === '6258fae1-fbd0-45f1-8aef-68b76a30276e' && (company === 'bra' || company === 'dis')) {
          const r = await repo.getGuidByParams('alg', 'artikel', 'foto', request.params.guid.toLowerCase(), culture, 'any')
          if (r && r.result)
            _guid = r.result.guid.toLowerCase()
        }
      }
      const _fn = `${env['DATA_PATH']}/content/${_guid.substring(0, 2)}/${_guid}/file`

      if (fs.existsSync(_fn)) {
        const lastMod = fs.statSync(_fn).mtime
        const etag = sha1(lastMod.toISOString())

        reply
          .header('Cache-Control', 'must-revalidate, max-age=172800, private')
          //.header('image-color', await imageTools.getColor(_fn, options))
          .header('Expires', new Date(new Date().getTime() + 172800000).toUTCString())
          .header('Last-Modified', lastMod.toUTCString())
          .header('etag', etag)
          .type(options.webp ? 'image/webp' : 'image/jpeg')

        const data = await imageTools.getImage(_fn, '/' + (config.imageSizeFileMap[options.size] ?? 'file'), etag, options)
        return reply
          .send(data)
      }

      return reply.error('File not found!', 404, performance.now() - start)
    } catch (err) {
      request.log.error({ err }, 'failed to get product image "' + request.params.guid.toLowerCase() + '"!')
      return reply.error('failed to get product image "' + request.params.guid.toLowerCase() + '"!')
    }
  })

  /**
   * @route /{APP_VERSION}/product-images/:company/:itemnum/:cuture?
   */
  fastify.get('/:company/:itemnum', getItem)
  fastify.get('/:company/:itemnum/:culture', getItem)
}

/**
 * 
 * @param {Request} request
 * @param {Reply} reply
 */
async function getItem(request: FastifyRequest<{ Params: { company: string, itemnum: string, culture?: string }, Querystring: { size?: string, s?: string } }>, reply) {
  const start = performance.now()

  try {
    let repo = new Document(request.log)
    const size = request.query.size ?? 'any'
    const s = request.query.s ?? 'normal'
    const culture = request.params.culture ?? 'all'

    let options: IToolsOptions = {
      size: config.imageSizeMap[s] ?? 800,
      quality: config.imageQualityMap[s] ?? config.defaultImageQuality,
      cache: config.cacheEnabled ?? false,
      // Enable webp automatically if the client supports it
      webp: (request.headers['accept'] && request.headers['accept'].indexOf('image/webp') > -1) ? true : false
    }

    // get file guid for request
    const response = await repo.getGuidByParams(request.params.company, 'artikel', 'foto', request.params.itemnum, culture, size)

    if (response) {
      const _guid = response.result.guid.toLowerCase()
      const _fn = `${env['DATA_PATH']}/content/${_guid.substring(0, 2)}/${_guid}/file`

      if (fs.existsSync(_fn)) {
        const lastMod = fs.statSync(_fn).mtime
        const etag = sha1(lastMod.toISOString())

        reply.header('Cache-Control', 'must-revalidate, max-age=172800, private')
          //.header('image-color', await imageTools.getColor(_fn, options))
          .header('image-guid', _guid)
          .header('Expires', new Date(new Date().getTime() + 172800000).toUTCString())
          .header('Last-Modified', lastMod.toUTCString())
          .type(options.webp ? 'image/webp' : 'image/jpeg')
          .header('etag', etag)

        const data = await imageTools.getImage(_fn, '/' + (config.imageSizeFileMap[options.size] ?? 'file'), etag, options)
        return reply
          .send(data)
      } else {
        return reply.error('File not found!', 404, performance.now() - start)
      }
    }

    return reply.error('File not found!', 404, performance.now() - start)
  } catch (err) {
    request.log.error({ err }, 'failed to get product image!')
    return reply.error('failed to get product image!')
  }
}

/**
 *
 * @param {FastifyRequest} request
 * @returns
 */
function resolveCompany(request) {
  if (request.headers.referer) {
    if (request.headers.referer.includes('claes-machines.be'))
      return 'mac'
    if (request.headers.referer.includes('groupclaes.be'))
      return 'gro'
    if (request.headers.referer.includes('brabopak.com'))
      return 'bra'
  }

  return 'dis'
}

interface IToolsOptions {
  size: number,
  quality?: number
  cache?: boolean
  webp: boolean
}