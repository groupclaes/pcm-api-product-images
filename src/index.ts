import Fastify from '@groupclaes/fastify-elastic'
import { FastifyInstance } from 'fastify'
import { env } from 'node:process'

import productImagesController from './controllers/product-images.controller'

const LOGLEVEL = 'debug'

export default async function main(config?: any): Promise<FastifyInstance | undefined> {
  let fastify: FastifyInstance | undefined = undefined

  if (config?.wrapper) {
    try {
      // fix old config sql declaration
      if (!config.wrapper.mssql && config.mssql) {
        config.wrapper.mssql = config.mssql
      }

      // force enable ecs format
      // config.wrapper.ecs = true
      config.wrapper.fastify.requestLogging = true

      fastify = await Fastify(config.wrapper)
      const version_prefix = env.APP_VERSION ? '/' + env.APP_VERSION : ''
      fastify.log.level = LOGLEVEL
      await fastify.register(require('@fastify/etag'))
      await fastify.register(productImagesController, {
        prefix: `${version_prefix}/${config.wrapper.serviceName}`,
        logLevel: 'info'
      })
      await fastify.listen({ port: +(env['PORT'] ?? 80), host: '::' })
    } catch (err) {
      console.error({ err }, 'Fastify has returned an error at runtime')
    }
  }
  return fastify
}
