// Static files only. For Rewrite (OpenAI), use `npm start` → scripts/server.js
// Assignment logic: js/script.js

const { execSync } = require('child_process')

const port = process.env.PORT || 8080
let cmd = `serve --listen ${port}  --no-clipboard`

if (process.argv.length > 2) cmd += ` ${process.argv.slice(2).join(' ')}`

// eslint-disable-next-line no-console
console.log(`Running "${cmd}"...`)
console.log('****IF THE SERVER(s) LISTED HAVE PORT :10000, do not try to visit/open it, it is only for the test.***')


execSync(cmd, { stdio: 'inherit' })
