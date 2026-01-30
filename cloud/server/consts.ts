
export const PROD = process.env.NODE_ENV == 'production'
export const TEST = process.env.NODE_ENV == 'test'

export const DOMAIN = PROD ? (process.env.DOMAIN || 'graphenedata.com') : 'localhost'
