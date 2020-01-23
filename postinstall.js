const { spawn } = require('child_process')

if (process.env.POSTINSTALL !== 'local') {
    console.log('test')
    // const bat = spawn('npm', ['run', 'build'])
    // bat.stdout.on('data', (data) => {
    //     console.log(data.toString())
    // })

    // bat.stderr.on('data', (data) => {
    //     console.error(data.toString())
    // })

    // bat.on('exit', (code) => {
    //     console.log(`Child exited with code ${code}`)
    // })
}