import { app, action, core, constants } from 'photoshop'
import type { ExecutionContext } from 'photoshop/dom/CoreModules'
import type { Layer } from 'photoshop/dom/Layer'
import type { Bounds } from './types'
import type { SolidColor } from 'photoshop/dom/objects/SolidColor'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { storage: { localFileSystem: fs, formats } } = require('uxp')

let isRunning = false

export const batchPlay: typeof action.batchPlay = (commands: any[]) => action.batchPlay(commands, { modalBehavior: 'wait', synchronousExecution: false })
export const suspendHistory = async (fn: ((ctx: ExecutionContext) => Promise<unknown>) | (() => void), name: string, commit = true) => {
  if (isRunning) throw Error('正在运行中...')
  let error: any
  await core.executeAsModal(async ctx => {
    isRunning = true
    const documentID = app.activeDocument.id
    const history = await ctx.hostControl.suspendHistory({ name, documentID })
    try {
      await fn(ctx)
      await ctx.hostControl.resumeHistory(history)
    } catch (err) {
      error = err
      await ctx.hostControl.resumeHistory(history, commit)
    }
  }, { commandName: name, interactive: false }).finally(() => { isRunning = false })
  if (error) throw error
}

export interface FileEntry {
  nativePath: string
  isFile: boolean
  delete: () => Promise<void>
  read: (options: { format: any }) => Promise<ArrayBuffer>
}

export const exportImage = async (doc = app.activeDocument, isJpg = true) => {
  const folder = await fs.getTemporaryFolder()
  const file = await folder.createFile(`export-${Math.random().toString(36).slice(2)}.${isJpg ? 'jpg' : 'png'}`, { overwrite: true })

  if (isJpg) await doc.saveAs.jpg(file, { quality: 12 } as any, true)
  else await doc.saveAs.png(file, { compression: 6 } as any, true)

  return file as FileEntry
}

export const offset = (v: number) => ({ _unit: 'pixelsUnit', _value: v })

export const addRect = (left: number, top: number, right: number, bottom: number, color: SolidColor) => batchPlay(
  [{
    _obj: 'make',
    _target: [{ _ref: 'contentLayer' }],
    using: {
      _obj: 'contentLayer',
      shape: {
        _obj: 'rectangle', unitValueQuadVersion: 1, bottom: offset(bottom), left: offset(left), right: offset(right), top: offset(top)
      },
      strokeStyle: {
        _obj: 'strokeStyle', fillEnabled: false, strokeEnabled: true, strokeStyleBlendMode: { _enum: 'blendMode', _value: 'normal' },
        strokeStyleContent: { _obj: 'solidColorLayer', color: { _obj: 'RGBColor', blue: color.rgb.blue, grain: color.rgb.green, red: color.rgb.red } },
        strokeStyleLineAlignment: { _enum: 'strokeStyleLineAlignment', _value: 'strokeStyleAlignCenter' },
        strokeStyleLineCapType: { _enum: 'strokeStyleLineCapType', _value: 'strokeStyleButtCap' },
        strokeStyleLineDashOffset: { _unit: 'pointsUnit', _value: 0.0 }, strokeStyleLineDashSet: [],
        strokeStyleLineJoinType: { _enum: 'strokeStyleLineJoinType', _value: 'strokeStyleMiterJoin' },
        strokeStyleLineWidth: { _unit: 'pixelsUnit', _value: 8.0 }, strokeStyleMiterLimit: 100.0,
        strokeStyleOpacity: { _unit: 'percentUnit', _value: 100.0 }, strokeStyleResolution: 72.0,
        strokeStyleScaleLock: false, strokeStyleStrokeAdjust: false, strokeStyleVersion: 2
      },
      type: { _obj: 'solidColorLayer', color: { _obj: 'RGBColor', blue: 0.0, grain: 0.0, red: 0.0 } }
    }
  }]
)

export const makeSelection = () => batchPlay(
  [{ _obj: 'set', _target: [{ _property: 'selection', _ref: 'channel' }], to: { _ref: [{ _enum: 'path', _ref: 'path', _value: 'vectorMask' }, { _enum: 'ordinal', _ref: 'layer', _value: 'targetEnum' }] }, vectorMaskParams: true, version: 1 }]
)

export const disactiveAllLayers = () => { app.activeDocument.activeLayers.forEach(it => (it.selected = false)) }
export const setActiveLayer = (layer: Layer) => {
  app.activeDocument.activeLayers.forEach(it => layer !== it && (it.selected = false))
  layer.selected = true
}
export function deleteLayer (layer: Layer | string) {
  if (typeof layer === 'string') {
    app.activeDocument.layers.forEach(it => { it.name === layer && deleteLayer(it) })
    return
  }
  layer.layers?.forEach(deleteLayer)
  setActiveLayer(layer)
  layer.allLocked = false
  layer.delete()
}

export const mergeLayers = async () => {
  disactiveAllLayers()
  const layer = (await app.activeDocument.createPixelLayer({ name: 'Omokage - Merged' }))!
  setActiveLayer(layer)
  await batchPlay([{ _obj: 'mergeVisible', duplicate: true }])
  return layer
}
export const findLayer = (name: string) => app.activeDocument?.layers?.find(it => it.name === name)
export const findMergeLayer = () => findLayer('Omokage - Merged')

export async function exportLayer (layer: Layer, isJpg = true, width = layer.bounds.right - layer.bounds.left, height = layer.bounds.bottom - layer.bounds.top): Promise<FileEntry> {
  const newDoc = await app.documents.add({
    width,
    height,
    resolution: 72,
    mode: constants.NewDocumentMode.RGB,
    fill: constants.DocumentFill.BLACK
  })
  if (!newDoc) throw Error('Cannot create new document')
  setActiveLayer(layer)
  const newLayer = (await layer.duplicate(newDoc))!
  await newLayer.scale(width / (newLayer.bounds.right - newLayer.bounds.left) * 100, height / (newLayer.bounds.bottom - newLayer.bounds.top) * 100)
  await newLayer.translate(-newLayer.bounds.left, -newLayer.bounds.top)
  try {
    return await exportImage(newDoc, isJpg)
  } finally {
    newDoc.closeWithoutSaving()
  }
}

export const copyToNewLayer = () => batchPlay([{ _obj: 'copyToLayer' }])
export const importLayer = async (buffer: ArrayBuffer) => {
  const file = await (await fs.getTemporaryFolder()).createFile(`generated-${Math.random().toString(36).slice(2)}.png`, { overwrite: true })
  await file.write(buffer, { format: formats.binary })
  await batchPlay(
    [
      {
        _obj: 'placeEvent',
        null: {
          _path: await fs.createSessionToken(file),
          _kind: 'local'
        },
        freeTransformCenterState: {
          _enum: 'quadCenterState',
          _value: 'QCSAverage'
        },
        offset: {
          _obj: 'offset',
          horizontal: {
            _unit: 'pixelsUnit',
            _value: 0
          },
          vertical: {
            _unit: 'pixelsUnit',
            _value: 0
          }
        },
        _options: {
          dialogOptions: 'dontDisplay'
        }
      }
    ]
  )
  file.delete().catch(console.error)
}

export const importLayerAndRecover = async (buf: ArrayBuffer, bounds: Bounds, name?: string) => {
  await importLayer(buf)
  const layer = app.activeDocument.activeLayers[0]
  if (name) layer.name = name
  await layer.scale((bounds.right - bounds.left) / (layer.bounds.right - layer.bounds.left) * 100, (bounds.bottom - bounds.top) / (layer.bounds.bottom - layer.bounds.top) * 100)

  const widthDiff = ((bounds.right - bounds.left) - (layer.bounds.right - layer.bounds.left)) / 2
  const heightDiff = ((bounds.bottom - bounds.top) - (layer.bounds.bottom - layer.bounds.top)) / 2

  await layer.translate(bounds.left - layer.bounds.left + widthDiff, bounds.top - layer.bounds.top + heightDiff)
}
export const importLayerAndRecoverLimited = (buf: ArrayBuffer, bounds: Bounds, width: number, height: number, name?: string) => importLayerAndRecover(buf, {
  top: Math.max(0, bounds.top),
  left: Math.max(0, bounds.left),
  right: Math.min(width, bounds.right),
  bottom: Math.min(height, bounds.bottom)
}, name)

export const blurryEdges = (scale: number) => batchPlay([
  // 建立:
  { _obj: 'make', at: { _enum: 'channel', _ref: 'channel', _value: 'mask' }, duplicate: true, new: { _class: 'channel' }, using: { _enum: 'channel', _ref: 'channel', _value: 'transparencyEnum' } },
  // 设置 选区
  { _obj: 'set', _target: [{ _property: 'selection', _ref: 'channel' }], to: { _enum: 'ordinal', _ref: 'channel', _value: 'targetEnum' } },
  // 收缩
  { _obj: 'contract', by: { _unit: 'pixelsUnit', _value: 23 * scale }, selectionModifyEffectAtCanvasBounds: false },
  // 羽化
  { _obj: 'feather', radius: { _unit: 'pixelsUnit', _value: 12 * scale }, selectionModifyEffectAtCanvasBounds: false },
  // 反向
  { _obj: 'inverse' },
  // 复位 色板
  { _obj: 'reset', _target: [{ _property: 'colors', _ref: 'color' }] },
  // 删除
  { _obj: 'delete' },
  // 羽化
  { _obj: 'feather', radius: { _unit: 'pixelsUnit', _value: 50 * scale }, selectionModifyEffectAtCanvasBounds: false },
  // 删除
  { _obj: 'delete' }
])

export const getColor = (red: number, green: number, blue: number) => {
  const color = new app.SolidColor()
  color.rgb.red = red
  color.rgb.green = green
  color.rgb.blue = blue
  return color
}
export const randomColor = () => getColor(Math.random() * 255, Math.random() * 255, Math.random() * 255)

export const createSnapshot = (name: string) => batchPlay(
  [{
    _obj: 'make',
    _target: [{ _ref: 'snapshotClass' }],
    from: { _property: 'currentHistoryState', _ref: 'historyState' },
    name,
    using: { _enum: 'historyState', _value: 'fullDocument' }
  }]
)

export const deleteSnapshot = (name: string) => batchPlay(
  [{
    _obj: 'delete',
    _target: [{ _ref: 'snapshotClass', _name: name }]
  }]
)

export const selectSnapshot = (name: string) => batchPlay(
  [{
    _obj: 'select',
    _target: [{ _ref: 'snapshotClass', _name: name }]
  }]
)

export const backToSnapshop = async (name: string) => {
  await selectSnapshot(name)
  // await deleteSnapshot(name)
}

export const selectRetangleToole = () => batchPlay(
  [{
    _obj: 'select',
    _target: [{ _ref: 'rectangleTool' }]
  }]
)

export const deselect = () => batchPlay(
  [{
    _obj: 'set',
    _target: [{ _ref: 'channel', _property: 'selection' }],
    to: { _enum: 'ordinal', _value: 'none' }
  }]
)


export const undo = () => core.executeAsModal(
  () => batchPlay([{ _obj: 'select', _target: [{ _enum: 'ordinal', _ref: 'historyState', _value: 'previous' }] }]),
  { commandName: 'Undo' }
)

export const makeRectSelection = (left: number, top: number, right: number, bottom: number) => batchPlay(
  [{
    _obj: 'set',
    _target: [{ _property: 'selection', _ref: 'channel' }],
    to: { _obj: 'rectangle', bottom: offset(bottom), left: offset(left), right: offset(right), top: offset(top) }
  }]
)

export function base64 (buffer: ArrayBuffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i])
  return window.btoa(binary)
}

export function decodeBase64 (base64: string) {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export const selectionTransform = (angle: number) => batchPlay(
  [{
    _obj: 'transform',
    _target: [{ _property: 'selection', _ref: 'channel' }],
    angle: { _unit: 'angleUnit', _value: angle },
    freeTransformCenterState: { _enum: 'quadCenterState', _value: 'QCSAverage' },
    interfaceIconFrameDimmed: { _enum: 'interpolationType', _value: 'bilinear' },
    linked: true,
    offset: { _obj: 'offset', horizontal: offset(0), vertical: offset(0) }
  }]
)

export const checkSelection = () => batchPlay(
  [{ _obj: 'get', _target: [{ _property: 'selection' }, { _ref: 'document', _id: app.activeDocument.id }] }]
).then(it => !!(it?.[0]?.selection))

export const getSelectionBounds = () => batchPlay(
  [{ _obj: 'get', _target: [{ _property: 'selection' }, { _ref: 'document', _id: app.activeDocument.id }] }]
).then(([{ selection: s }]) => ({ left: s.left._value, top: s.top._value, right: s.right._value, bottom: s.bottom._value }) as any as Bounds)

export const openSmartObject = () => batchPlay([{ _obj: 'newPlacedLayer' }, { _obj: 'placedLayerEditContents' }])

const mainPage = document.getElementById('main-buttons')!
const matte = document.getElementById('matte')!
export const checkPage = () => {
  if (findLayer('Omokage - Matte')) {
    matte.style.display = ''
    mainPage.style.display = 'none'
    return
  }
  mainPage.style.display = ''
  matte.style.display = 'none'
}

void action.addNotificationListener(['select', 'hostFocusChanged', 'newDocument', 'close'], checkPage)
setTimeout(checkPage)
