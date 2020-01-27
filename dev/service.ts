import kable from '../lib/kable'

const foo = kable('foo')
foo.up()
foo.suscribe('mongo-service', console.log)