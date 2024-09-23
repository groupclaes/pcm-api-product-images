import Fastify from '@groupclaes/fastify-elastic'
import { FastifyInstance } from 'fastify'
import { env } from 'process'

import productImagesController from './controllers/product-images.controller'

const LOGLEVEL = 'debug'

export default async function (config: any): Promise<FastifyInstance | undefined> {
  if (!config || !config.wrapper) return

  const fastify = await Fastify({ ...config.wrapper })
  const version_prefix = env.APP_VERSION ? '/' + env.APP_VERSION : ''
  fastify.log.level = LOGLEVEL
  await fastify.register(require('@fastify/etag'))
  await fastify.register(productImagesController, { prefix: `${version_prefix}/${config.wrapper.serviceName}`, logLevel: 'info' })
  await fastify.listen({ port: +(env['PORT'] ?? 80), host: '::' })

  return fastify
}