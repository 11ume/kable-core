import kable from '../lib/kable'

const foo = kable('foo')
const bar = kable('bar')

foo.up()
bar.up()
foo.pick('bar').then(console.log)