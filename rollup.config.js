import buble from 'rollup-plugin-buble'
import uglify from 'rollup-plugin-uglify'
import resolve from 'rollup-plugin-node-resolve'

const pkg = require('./package.json')
const env = process.env.NODE_ENV || 'development'
const isProduction = env !== 'development'

const plugins = [
  buble()
]
const dest = {
  development: 'dist/hateoas-query.js',
  production: 'dist/hateoas-query.min.js'
}

plugins.unshift(
  resolve()
)

if (env === 'production') {
  plugins.push(uglify())
}

export default {
  input: 'src/index.js',
  plugins,
  output: [
    { file: dest[env], format: 'umd', name: 'hateoas' }
  ],
  sourcemap: isProduction,
  external: Object.keys(pkg.dependencies || {})
}
