import { NodeEmitter } from './../lib/eventsDriver'
import { delay } from './../lib/utils/utils'
import kable from '../lib/kable'

const foo = kable('foo')
const bar = kable('bar')

foo.up(false)
bar.up(false)

const log = (msg: NodeEmitter) => console.log(msg)
foo.suscribe('bar', log)

const main = async () => {
    await delay(1000)
    bar.start()
    await delay(1000)
    bar.stop()
    await delay(1000)
    bar.down()
}

main()