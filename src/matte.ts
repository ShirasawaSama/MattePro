import { app, core, constants } from 'photoshop'
import {
    checkSelection, batchPlay, disactiveAllLayers, mergeLayers, setActiveLayer, getColor, suspendHistory, deselect, openSmartObject,
    findMergeLayer, findLayer, exportImage, importLayerAndRecoverLimited, deleteLayer, checkPage
} from './utils'
import { matte } from './api'
import type { SolidColor } from 'photoshop/dom/objects/SolidColor'

let prevForeground: SolidColor
let prevBackground: SolidColor

const setBrush = (tool = 'paintbrushTool') => {
    prevBackground = getColor(app.backgroundColor.rgb.red, app.backgroundColor.rgb.green, app.backgroundColor.rgb.blue)
    prevForeground = getColor(app.foregroundColor.rgb.red, app.foregroundColor.rgb.green, app.foregroundColor.rgb.blue)
    return batchPlay([
        { _obj: 'select', _target: [{ _ref: tool }] },
        {
            _obj: 'set',
            _target: [{ _ref: tool }],
            to: {
                _obj: 'currentToolOptions',
                smooth: 0,
                opacity: 100,
                flow: 100
            }
        },
        {
            _obj: 'set',
            _target: [{ _enum: 'ordinal', _ref: 'brush', _value: 'targetEnum' }],
            to: {
                _obj: 'brush',
                diameter: { _unit: 'pixelsUnit', _value: 100 },
                roundness: { _unit: 'percentUnit', _value: 100 },
                hardness: { _unit: 'percentUnit', _value: 100 },
                smooth: 0,
                opacity: 100,
                flow: 100
            }
        }
    ])
}

document.getElementById('matte-green')!.onclick = () => core.executeAsModal(async () => {
    await setBrush()
    app.foregroundColor = getColor(0, 255, 0)
    app.backgroundColor = getColor(255, 0, 0)
}, { commandName: 'Matte - Set Color' })
document.getElementById('matte-red')!.onclick = () => core.executeAsModal(async () => {
    await setBrush()
    app.foregroundColor = getColor(255, 0, 0)
    app.backgroundColor = getColor(0, 255, 0)
}, { commandName: 'Matte - Set Color' })
document.getElementById('matte-remove')!.onclick = () => core.executeAsModal(() => setBrush('eraserTool'), { commandName: 'Matte - Set Tool' })

document.getElementById('matte-btn')!.onclick = async () => {
    if (!await checkSelection()) {
        alert('请创建一个大致的选区, 推荐使用对象选择工具或选择主体!')
        return
    }

    await suspendHistory(async () => {
        disactiveAllLayers()
        await mergeLayers()

        const doc = app.activeDocument
        const layer = (await doc.createLayer())!
        layer.name = 'Omokage - Matte'
        layer.opacity = 55
        setActiveLayer(layer)
        await batchPlay([
            {
                _obj: 'fill',
                color: { _obj: 'RGBColor', blue: 0, grain: 0, red: 255 },
                mode: { _enum: 'blendMode', _value: 'normal' },
                opacity: { _unit: 'percentUnit', _value: 100.0 },
                using: { _enum: 'fillContents', _value: 'color' }
            },
            {
                _obj: 'set',
                _target: [{ _property: 'layerEffects', _ref: 'property' }, { _enum: 'ordinal', _ref: 'layer', _value: 'targetEnum' }],
                to: {
                    _obj: 'layerEffects',
                    frameFX: {
                        _obj: 'frameFX',
                        color: { _obj: 'RGBColor', blue: 0, grain: 255, red: 0 },
                        enabled: true,
                        mode: { _enum: 'blendMode', _value: 'normal' },
                        opacity: { _unit: 'percentUnit', _value: 100.0 },
                        overprint: false,
                        paintType: { _enum: 'frameFill', _value: 'solidColor' },
                        present: true, showInDialog: true,
                        size: { _unit: 'pixelsUnit', _value: 8.0 },
                        style: { _enum: 'frameStyle', _value: 'centeredFrame' }
                    },
                    scale: { _unit: 'percentUnit', _value: 100.0 }
                }
            }
        ])
        // await setBrush()
        await deselect()

        setActiveLayer(findMergeLayer()!)
        layer.selected = true
        await openSmartObject()

        await setBrush()
        app.foregroundColor = getColor(0, 255, 0)
        app.backgroundColor = getColor(255, 0, 0)
    }, 'Omokage - 精细抠图', false).catch(e => {
        console.error(e)
        alert(e.message)
    })

    checkPage()
}

const matteHardnessElm = document.getElementById('matte-hardness') as HTMLInputElement
const matteMaskOnlyElm = document.getElementById('matte-mask-only') as HTMLInputElement
document.getElementById('do-matte')!.onclick = () => {
    const merged = findMergeLayer()
    const layer = findLayer('Omokage - Matte')
    if (!merged || !layer) {
        alert('找不到精细抠图所需图层!')
        checkPage()
        return
    }

    suspendHistory(async ctx => {
        setActiveLayer(layer)
        layer.visible = false

        const img = await exportImage()

        const doc = app.activeDocument
        doc.layers.forEach(l => {
            if (l !== layer) {
                setActiveLayer(l)
                l.visible = false
            }
        })
        setActiveLayer(layer)
        layer.visible = true
        layer.opacity = 100
        const trimap = await exportImage(undefined, false)
        const b = layer.bounds

        let task: Task
        try {
            deleteLayer(layer)
            deleteLayer(merged)

            task = await matte(img, trimap, [b.left, b.top, b.right, b.bottom])
        } finally {
            return
            img.delete().catch(console.error)
            trimap.delete().catch(console.error)
        }
        // const result = await waitTaskResult(task, ctx)

        await importLayerAndRecoverLimited(result, b, doc.width, doc.height, 'Omokage - Matted')
        let matteLayer = doc.activeLayers[0]

        const backLayer = (await doc.createLayer())!
        setActiveLayer(backLayer)
        await batchPlay([
            { _obj: 'fill', mode: { _enum: 'blendMode', _value: 'normal' }, opacity: { _unit: 'percentUnit', _value: 100 }, using: { _enum: 'fillContents', _value: 'black' } }
        ])
        backLayer.move(matteLayer, constants.ElementPlacement.PLACEAFTER)
        matteLayer.selected = true
        await matteLayer.merge()
        await app.activeDocument.close(constants.SaveOptions.SAVECHANGES)

        matteLayer = findLayer('Omokage - Matte')!
        if (!matteLayer) {
            alert('找不到精细抠图所需图层!')
            return
        }

        const hardness = +matteHardnessElm.value / 100
        await batchPlay([
            hardness > 0.05
                ? { _obj: 'colorRange', colorModel: 0, fuzziness: 200 * hardness, maximum: { _obj: 'labColor', a: 0.0, b: 0.0, luminance: 99.66 }, minimum: { _obj: 'labColor', a: 0.0, b: 0.0, luminance: 99.66 } }
                : { _obj: 'set', _target: [{ _property: 'selection', _ref: 'channel' }], to: { _enum: 'channel', _ref: 'channel', _value: 'RGB' } }
        ])
        if (!matteMaskOnlyElm.checked) deleteLayer(matteLayer)

        if (prevForeground) app.foregroundColor = prevForeground
        if (prevBackground) app.backgroundColor = prevBackground
    }, 'Omokage - 精细抠图', false).catch(e => {
        console.error(e)
        alert(e.message)
    })

    checkPage()
}