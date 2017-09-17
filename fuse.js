const {
  BabelPlugin,
  FuseBox,
  Sparky,
  QuantumPlugin
} = require('fuse-box')

let fuse, app
let isProduction = false

Sparky.task('config', () => {
  fuse = FuseBox.init({
    package: 'hateoas-query',
    globals: {
      default: 'hateoas'
    },
    homeDir: `src/`,
    hash: false,
    sourceMaps: isProduction,
    output: `dist/$name-$hash${isProduction ? '.min' : ''}.js`,
    plugins: [
      BabelPlugin(),
      QuantumPlugin({
        bakeApiIntoBundle: 'hateoas-query',
        containedAPI: true,
        treeshake: true,
        uglify: isProduction
      })
    ]
  })
  app = fuse.bundle('hateoas-query').instructions('> index.js')
})

Sparky.task('default', ['config'], () => {
  fuse.dev()
  app.watch().hmr()

  return fuse.run()
})

Sparky.task('clean', () => Sparky.src('dist').clean('dist'))
Sparky.task('setProduction', () => { isProduction = true })
Sparky.task('dist', ['setProduction', 'config'], () => fuse.run())
