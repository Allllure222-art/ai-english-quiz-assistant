/**
 * pdf.js 5.x worker 使用 `Math.sumPrecise`（较新引擎），Node 22 常缺失，会触发警告或部分失败。
 */
function ensureMathSumPrecise() {
    if (typeof Math.sumPrecise === 'function') return
    Math.sumPrecise = function sumPrecise(iterable) {
        let total = 0
        for (const x of iterable) {
            total += Number(x) || 0
        }
        return total
    }
}

/**
 * pdf.js 5.x 主线程消息处理使用 `Promise.try`（较新引擎内置），Node 22 等环境缺失会报错。
 */
function ensurePromiseTry() {
    if (typeof Promise.try === 'function') return
    Promise.try = function tryFn(fn, ...args) {
        return new Promise((resolve, reject) => {
            try {
                resolve(fn(...args))
            } catch (e) {
                reject(e)
            }
        })
    }
}

/**
 * pdfjs-dist 在 Node 下抽取文本时会用到浏览器图形 API；未注入时会报
 * `DOMMatrix is not defined` / `Path2D is not defined`。
 *
 * pdf.js 5.x 非 legacy 包假定存在 `Uint8Array.prototype.toHex`（较新浏览器内置），
 * Node 上缺失会导致 worker 内 `hashOriginal.toHex is not a function`。
 */
function ensureUint8ArrayToHex() {
    const proto = globalThis.Uint8Array?.prototype
    if (!proto) return
    if (typeof proto.toHex === 'function') {
        try {
            const probe = new Uint8Array([
                255, 255, 255, 255, 255, 255, 255, 255,
            ])
            if (probe.toHex() === 'ffffffffffffffff') return
        } catch {
            /* 原生实现异常时覆盖 */
        }
    }
    Object.defineProperty(proto, 'toHex', {
        configurable: true,
        writable: true,
        enumerable: false,
        value: function toHex() {
            let out = ''
            for (let i = 0; i < this.length; i += 1) {
                const h = this[i].toString(16)
                out += h.length === 1 ? `0${h}` : h
            }
            return out
        },
    })
}

let installed = false

export async function ensurePdfJsNodeGlobals() {
    if (installed) return
    installed = true

    ensurePromiseTry()
    ensureMathSumPrecise()
    ensureUint8ArrayToHex()

    if (typeof globalThis.DOMMatrix === 'undefined') {
        const mod = await import('@thednp/dommatrix')
        globalThis.DOMMatrix = mod.default
    }

    if (typeof globalThis.Path2D === 'undefined') {
        const { Path2D } = await import('path2d')
        globalThis.Path2D = Path2D
    }
}
