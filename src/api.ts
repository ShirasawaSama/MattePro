import type { FileEntry } from './utils'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const lib = window.require('MattePro.uxpaddon')

export const matte = async (image: FileEntry, trimap: FileEntry, rect: [number, number, number, number]) => {
    const ret: boolean | Error = (await lib).matte({ image: image.nativePath, trimap: trimap.nativePath, rect: { '0': rect[0], '1': rect[1], '2': rect[2], '3': rect[3] } })
    console.log(ret)
    if (!ret || ret instanceof Error) {
        if (ret) console.error(ret)
        throw new Error('抠图失败!')
    }

    // return await postFilesToBackend('/matte', [
    //     await image.read({ format: formats.binary }),
    //     await trimap.read({ format: formats.binary })
    // ])
}
