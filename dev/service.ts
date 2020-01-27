import { NodeEmitter } from './../lib/eventsDriver'
import kable from '../lib/kable'

const main = async () => {
    const foo = kable('foo')
    const bar = kable('bar')
    await foo.up()
    await bar.up(false)

    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        foo.suscribe('bar', (payload) => {
            if (payload.start) {
                resolve(payload)
            }
        })

        bar.start()
    })

    const n = await check()
    console.log(n)
    foo.down()
    bar.down()
}

main()
