import './alerts'
import './matte'

// eslint-disable-next-line @typescript-eslint/no-var-requires
document.getElementById('version')!.innerText = `(v${require('uxp').versions.plugin})`


// eslint-disable-next-line @typescript-eslint/no-var-requires
document.getElementById('offical-website')!.onclick = () => require('uxp').shell.openExternal('https://omo.neko-craft.com')
