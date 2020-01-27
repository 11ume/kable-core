import { delay } from './../lib/utils/utils'
import kable from '../lib/kable'

const foo = kable('foo')
const bar = kable('bar')

foo.up(false)
bar.up(false)

foo.suscribe('bar', console.log)

const main = async () => {
    bar.start()
    await delay(1000)
    bar.stop()
}

main()