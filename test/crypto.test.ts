import test from 'ava'
import * as crypto from 'crypto'
import * as msgpack from '@msgpack/msgpack'
import { encrypt, decrypt } from '../lib/security/crypto'

const key = crypto.randomBytes(32)

test('encrypt and decrypt message', (t) => {
    const payload = msgpack.encode({ foo: 'foo' })
    const messageEncripted = encrypt(key, payload)
    t.truthy(Buffer.isBuffer(messageEncripted))

    const messageDeprited = decrypt(key, messageEncripted)
    t.deepEqual(msgpack.decode(messageDeprited), {
        foo: 'foo'
    })
})
