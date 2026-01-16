import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import sql from 'mssql'
import { env } from 'node:process'
import imageTools from '@groupclaes/pcm-imagetools'
import fs from 'node:fs'

import sha1 from '../crypto'
import Document from '../models/document.repository'

declare module 'fastify' {
  export interface FastifyInstance {
    getSqlPool: (name?: string) => Promise<sql.ConnectionPool>
  }

  export interface FastifyReply {
    success: (data?: any, code?: number, executionTime?: number) => FastifyReply
    fail: (data?: any, code?: number, executionTime?: number) => FastifyReply
    error: (message?: string, code?: number, executionTime?: number) => FastifyReply
  }
}
export default async function productImagesController(fastify: FastifyInstance) {
  /**
   * @route /{APP_VERSION}/product-images/:guid
   */
  fastify.get('/:guid', async function getByUuid(request: FastifyRequest<{
    Params: { guid: string },
    Querystring: { s: string }
  }>, reply: FastifyReply) {
    const start = performance.now()

    try {
      const pool = await fastify.getSqlPool()
      let repo = new Document(request.log, pool)
      const s = request.query.s ?? 'normal'

      let options: IToolsOptions = {
        size: config.imageSizeMap[s] ?? 800,
        quality: config.imageQualityMap[s] ?? config.defaultImageQuality,
        cache: config.cacheEnabled ?? false,
        webp: (request.headers['accept'] && request.headers['accept'].includes('image/webp')) ? true : false
      }
      let _guid = request.params.guid.toLowerCase()

      if (!/^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$/.test(_guid) && !Number.isNaN(Number.parseInt(_guid))) {
        const culture = 'all'
        const company = resolveCompany(request)
        const r = await repo.getGuidByParams(company, 'artikel', 'foto', request.params.guid.toLowerCase(), culture, 'any')
        if (r?.result) {
          _guid = r.result.guid.toLowerCase()
        }

        if (_guid === '6258fae1-fbd0-45f1-8aef-68b76a30276e' && company === 'bra') {
          const r = await repo.getGuidByParams('dis', 'artikel', 'foto', request.params.guid.toLowerCase(), culture, 'any')
          if (r?.result) {
            _guid = r.result.guid.toLowerCase()
          }
        }

        if (_guid === '6258fae1-fbd0-45f1-8aef-68b76a30276e' && (company === 'bra' || company === 'dis')) {
          const r = await repo.getGuidByParams('alg', 'artikel', 'foto', request.params.guid.toLowerCase(), culture, 'any')
          if (r?.result) {
            _guid = r.result.guid.toLowerCase()
          }
        }
      }
      const _fn = `${env['DATA_PATH']}/content/${_guid.substring(0, 2)}/${_guid}/file`

      if (fs.existsSync(_fn)) {
        const lastMod = fs.statSync(_fn).mtime
        const etag = sha1(lastMod.toISOString())

        reply
          .header('Cache-Control', 'must-revalidate, max-age=172800, private')
          //.header('image-color', await imageTools.getColor(_fn, options))
          .header('Expires', new Date(Date.now() + 172800000).toUTCString())
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
   *
   * @param {Request} request
   * @param {Reply} reply
   */
  async function getItem(request: FastifyRequest<{
    Params: { company: string, itemnum: string, culture?: string },
    Querystring: { size?: string, s?: string }
  }>, reply) {
    const start = performance.now()

    try {
      const pool = await fastify.getSqlPool()
      let repo = new Document(request.log, pool)
      const size = request.query.size ?? 'any'
      const s = request.query.s ?? 'normal'
      const culture = request.params.culture ?? 'all'

      let options: IToolsOptions = {
        size: config.imageSizeMap[s] ?? 800,
        quality: config.imageQualityMap[s] ?? config.defaultImageQuality,
        cache: config.cacheEnabled ?? false,
        // Enable webp automatically if the client supports it
        webp: (request.headers['accept'] && request.headers['accept'].includes('image/webp')) ? true : false
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
            .header('Expires', new Date(Date.now() + 172800000).toUTCString())
            .header('Last-Modified', lastMod.toUTCString())
            .type(options.webp ? 'image/webp' : 'image/jpeg')
            .header('etag', etag)

          const data = await imageTools.getImage(_fn, '/' + (config.imageSizeFileMap[options.size] ?? 'file'), etag, options)
          reply
            .send(data)
        } else {
          reply.error('File not found!', 404, performance.now() - start)
        }
      } else {
        reply.error('File not found!', 404, performance.now() - start)
      }
    } catch (err) {
      request.log.error({ err }, 'failed to get product image!')
      reply.error('failed to get product image!')
    }
  }

  /**
   * @route /{APP_VERSION}/product-images/:company/:itemnum/:cuture?
   */
  fastify.get('/:company/:itemnum', getItem)
  fastify.get('/:company/:itemnum/:culture', getItem)
}

/**
 *
 * @param {FastifyRequest} request
 * @returns
 */
function resolveCompany(request: FastifyRequest) {
  let company = 'dis'

  if (request.headers.referer) {
    if (request.headers.referer.includes('claes-machines.be')) {
      company = 'mac'
    } else if (request.headers.referer.includes('groupclaes.be')) {
      company = 'gro'
    } else if (request.headers.referer.includes('brabopak.com')) {
      company = 'bra'
    }
  }

  return company
}

const config = {
  cacheEnabled: true,
  imageSizeFileMap: {
    72: 'image_small',
    120: 'thumb',
    180: 'thumb_m',
    240: 'thumb_l',
    280: 'thumb_large',
    380: 'miniature',
    800: 'image',
    2048: 'image_large'
  },
  defaultImageQuality: 80,
  imageQualityMap: {
    'small': 80,
    'thumb': 80,
    'thumb_m': 80,
    'thumb_l': 70,
    'thumb_large': 70,
    'miniature': 70,
    'normal': 70,
    'large': 60
  },
  imageSizeMap: {
    'small': 72,
    'thumb': 120,
    'thumb_m': 180,
    'thumb_l': 240,
    'thumb_large': 280,
    'miniature': 380,
    'normal': 800,
    'large': 2048,
    'source': 0
  }
}

interface IToolsOptions {
  size: number,
  quality?: number
  cache?: boolean
  webp: boolean
}
